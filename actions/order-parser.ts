'use server';

import { parseOrderMessage, type ParsedOrderResult } from '@/lib/ai/order-parser';
import { getActiveOrgContext } from '@/lib/supabase/get-active-org';

export type ParseChatActionResult = {
  error?: string;
  data?: ParsedOrderResult;
};

export async function parseChatOrderAction(rawText: string): Promise<ParseChatActionResult> {
  const cleaned = rawText.trim();
  if (cleaned.length < 4) {
    return { error: 'Tempelkan isi pesan pesanan pelanggan terlebih dahulu.' };
  }

  const { supabase, organizationId } = await getActiveOrgContext();
  const [customersRes, productsRes] = await Promise.all([
    supabase
      .from('customers')
      .select('id, name, business_name, phone, tier, payment_terms')
      .eq('organization_id', organizationId)
      .eq('is_active', true),
    supabase
      .from('products')
      .select('id, sku, name, unit, selling_price, wholesale_price, current_stock')
      .eq('organization_id', organizationId)
      .eq('is_active', true),
  ]);

  const result = await parseOrderMessage({
    rawText: cleaned,
    customers: customersRes.data ?? [],
    products: (productsRes.data ?? []).map((p) => ({
      ...p,
      selling_price: Number(p.selling_price),
      wholesale_price: Number(p.wholesale_price),
      current_stock: Number(p.current_stock),
    })),
  });

  return { data: result };
}
