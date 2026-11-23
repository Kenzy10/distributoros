import type { Database } from '@/types/database.types';

type CustomerTier = Database['public']['Enums']['customer_tier'];

export type ParserCustomer = {
  id: string;
  name: string;
  business_name: string | null;
  phone: string | null;
  tier: CustomerTier;
  payment_terms: string;
};

export type ParserProduct = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  selling_price: number;
  wholesale_price: number;
  current_stock: number;
};

export type ParsedOrderItem = {
  product_id: string;
  sku: string;
  name: string;
  unit: string;
  qty: number;
  unit_price: number;
  current_stock: number;
  raw_line: string;
};

export type ParsedOrderResult = {
  customer_id: string | null;
  customer_confidence: 'high' | 'medium' | 'none';
  items: ParsedOrderItem[];
  unmatched_lines: string[];
  notes: string;
  engine: 'gemini' | 'smart-rules';
};

export function getTierUnitPrice(prod: ParserProduct, tier?: CustomerTier): number {
  return (tier === 'wholesale' || tier === 'agent') && prod.wholesale_price > 0
    ? prod.wholesale_price
    : prod.selling_price;
}

function normalizeText(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function matchCustomer(text: string, senderPhone: string | undefined, customers: ParserCustomer[]) {
  const cleanPhone = (senderPhone ?? '').replace(/\D/g, '');
  if (cleanPhone) {
    const byPhone = customers.find((c) => (c.phone ?? '').replace(/\D/g, '').endsWith(cleanPhone.slice(-9)));
    if (byPhone) return { id: byPhone.id, confidence: 'high' as const };
  }
  const norm = normalizeText(text);
  let best: { id: string; score: number } | null = null;
  for (const c of customers) {
    const candidates = [c.business_name, c.name].filter(Boolean).map((v) => normalizeText(v!));
    for (const cand of candidates) {
      if (cand.length >= 3 && norm.includes(cand)) {
        const score = cand.length + 10;
        if (!best || score > best.score) best = { id: c.id, score };
      }
    }
  }
  return best ? { id: best.id, confidence: 'high' as const } : { id: null, confidence: 'none' as const };
}

function parseWithRules(rawText: string, senderPhone: string | undefined, customers: ParserCustomer[], products: ParserProduct[]): ParsedOrderResult {
  const cust = matchCustomer(rawText, senderPhone, customers);
  const selectedCust = customers.find((c) => c.id === cust.id);
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const itemsMap = new Map<string, ParsedOrderItem>();
  const unmatched: string[] = [];
  const noteParts: string[] = [];

  for (const line of lines) {
    const normLine = normalizeText(line);
    if (/^(catatan|note|notes|kirim|alamat)\s*[:=-]/i.test(line)) {
      noteParts.push(line.replace(/^(catatan|note|notes)\s*[:=-]\s*/i, '').trim());
      continue;
    }
    const qtyMatch = line.match(/(?:^|\s|x|\*)(\d{1,5})\s*(dus|karton|krt|pcs|pc|box|pack|pak|sak|kg|liter|ltr|botol|btl|renteng|rtg|unit)?(?:\s|$)/i);
    let matchedProd: ParserProduct | undefined;
    let bestScore = 0;

    for (const p of products) {
      const skuNorm = normalizeText(p.sku);
      if (skuNorm && normLine.includes(skuNorm)) { matchedProd = p; bestScore = 100; break; }
      const tokens = normalizeText(p.name).split(' ').filter((t) => t.length >= 3);
      const hits = tokens.filter((t) => normLine.includes(t)).length;
      if (hits > 0 && hits >= Math.ceil(tokens.length * 0.5) && hits > bestScore) {
        bestScore = hits;
        matchedProd = p;
      }
    }

    if (matchedProd && qtyMatch) {
      const qty = Math.max(1, Number(qtyMatch[1]));
      const unitPrice = getTierUnitPrice(matchedProd, selectedCust?.tier);
      const prev = itemsMap.get(matchedProd.id);
      itemsMap.set(matchedProd.id, {
        product_id: matchedProd.id, sku: matchedProd.sku, name: matchedProd.name, unit: matchedProd.unit,
        qty: (prev?.qty ?? 0) + qty, unit_price: unitPrice, current_stock: matchedProd.current_stock, raw_line: line,
      });
    } else if (qtyMatch && !/^(halo|selamat|pagi|siang|sore|malam|min|order|pesan|terima)/i.test(normLine)) {
      unmatched.push(line);
    }
  }

  return { customer_id: cust.id, customer_confidence: cust.confidence, items: Array.from(itemsMap.values()), unmatched_lines: unmatched, notes: noteParts.join(' | '), engine: 'smart-rules' };
}

export async function parseOrderMessage(params: { rawText: string; senderPhone?: string; customers: ParserCustomer[]; products: ParserProduct[] }): Promise<ParsedOrderResult> {
  const { rawText, senderPhone, customers, products } = params;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return parseWithRules(rawText, senderPhone, customers, products);

  try {
    const prompt = `Ekstrak pesanan B2B dari pesan WhatsApp ini ke JSON valid: {"customer_id": string|null, "items": [{"product_id": string, "qty": number, "raw_line": string}], "unmatched_lines": string[], "notes": string}.
Daftar Pelanggan: ${JSON.stringify(customers.map((c) => ({ id: c.id, name: c.name, business: c.business_name, phone: c.phone })))}
Daftar Produk: ${JSON.stringify(products.map((p) => ({ id: p.id, sku: p.sku, name: p.name, unit: p.unit })))}
No Pengirim: ${senderPhone ?? '-'}
Pesan: """${rawText}"""`;

    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.1 } }),
    });
    if (!res.ok) return parseWithRules(rawText, senderPhone, customers, products);
    const json = await res.json();
    const parsed = JSON.parse(json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}');
    const validCust = customers.find((c) => c.id === parsed.customer_id) ?? customers.find((c) => c.id === matchCustomer(rawText, senderPhone, customers).id);
    const items: ParsedOrderItem[] = [];
    for (const row of parsed.items ?? []) {
      const prod = products.find((p) => p.id === row.product_id);
      if (prod && Number(row.qty) > 0) {
        items.push({ product_id: prod.id, sku: prod.sku, name: prod.name, unit: prod.unit, qty: Math.round(Number(row.qty)), unit_price: getTierUnitPrice(prod, validCust?.tier), current_stock: prod.current_stock, raw_line: String(row.raw_line ?? prod.name) });
      }
    }
    return { customer_id: validCust?.id ?? null, customer_confidence: validCust ? 'high' : 'none', items, unmatched_lines: Array.isArray(parsed.unmatched_lines) ? parsed.unmatched_lines : [], notes: String(parsed.notes ?? ''), engine: 'gemini' };
  } catch {
    return parseWithRules(rawText, senderPhone, customers, products);
  }
}
