'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { parseChatOrderAction } from '@/actions/order-parser';
import { createOrderAction, type OrderActionState } from '@/actions/orders';
import { formatRupiah } from '@/lib/utils';
import type { OrderCustomerOption, OrderProductOption } from './order-manager';
import type { ParsedOrderItem } from '@/lib/ai/order-parser';

export function AiOrderModal({
  isOpen,
  onClose,
  customers,
  products,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  customers: OrderCustomerOption[];
  products: OrderProductOption[];
  onSuccess: (msg: string) => void;
}) {
  const [rawText, setRawText] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [engineUsed, setEngineUsed] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState('');
  const [items, setItems] = useState<ParsedOrderItem[]>([]);
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [submitMode, setSubmitMode] = useState<'draft' | 'confirm'>('draft');
  const [isParsing, startParsing] = useTransition();
  const [saveState, saveAction, isSaving] = useActionState<OrderActionState, FormData>(createOrderAction, {});

  useEffect(() => {
    if (saveState.success) {
      setRawText('');
      setItems([]);
      setUnmatched([]);
      setCustomerId('');
      setNotes('');
      onSuccess(saveState.success);
      onClose();
    }
  }, [saveState.success, onClose, onSuccess]);

  if (!isOpen) return null;

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const resolvePrice = (prodId: string, fallback: number) => {
    const prod = products.find((p) => p.id === prodId);
    if (!prod) return fallback;
    return (selectedCustomer?.tier === 'wholesale' || selectedCustomer?.tier === 'agent') && prod.wholesale_price > 0
      ? prod.wholesale_price
      : prod.selling_price;
  };

  function handleFillSample() {
    const cName = customers[0]?.business_name || customers[0]?.name || 'Toko Maju Jaya';
    const p1 = products[0];
    const p2 = products[1];
    const sampleLines = [
      `Halo min, order untuk ${cName}:`,
      p1 ? `- ${p1.name} 2 ${p1.unit}` : '- Minyak Goreng 2 dus',
      p2 ? `- [${p2.sku}] 3 ${p2.unit}` : '',
      'Catatan: kirim besok pagi',
    ].filter(Boolean);
    setRawText(sampleLines.join('\n'));
  }

  function handleAnalyze() {
    setParseError(null);
    startParsing(async () => {
      const res = await parseChatOrderAction(rawText);
      if (res.error || !res.data) {
        setParseError(res.error ?? 'Gagal memproses pesan.');
        return;
      }
      setCustomerId(res.data.customer_id ?? '');
      setItems(res.data.items);
      setUnmatched(res.data.unmatched_lines);
      setNotes(res.data.notes);
      setEngineUsed(res.data.engine === 'gemini' ? 'Gemini AI' : 'Smart Parser');
    });
  }

  const effectiveItems = items.map((it) => ({ ...it, unit_price: resolvePrice(it.product_id, it.unit_price) }));
  const totalAmount = effectiveItems.reduce((sum, it) => sum + it.qty * it.unit_price, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between border-b pb-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">AI Order Parser (Chat WhatsApp → Draft Order)</h2>
            <p className="text-xs text-slate-600">Tempel pesan order dari WhatsApp untuk otomatis mencocokkan toko, SKU, dan jumlah.</p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-600 hover:text-slate-900">✕</button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-700">Pesan WhatsApp Pelanggan</label>
            <button type="button" onClick={handleFillSample} className="text-xs font-semibold text-blue-600 hover:underline">
              Isi Contoh Chat WA
            </button>
          </div>
          <textarea
            rows={4}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Contoh:&#10;Halo min, order Toko Berkah:&#10;- Minyak Goreng 5 dus&#10;- BRG-002 10 pcs"
            className="w-full rounded-lg border border-slate-300 p-3 text-sm text-slate-900"
          />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500">{engineUsed ? `Engine aktif: ${engineUsed}` : 'Mendukung nama toko, nomor WA, SKU & satuan'}</span>
            <button
              type="button"
              disabled={isParsing || !rawText.trim()}
              onClick={handleAnalyze}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {isParsing ? 'Menganalisis...' : '✨ Ekstrak Pesanan'}
            </button>
          </div>
        </div>

        {(parseError || saveState.error) && (
          <div className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3 text-xs font-medium text-red-800">
            {parseError || saveState.error}
          </div>
        )}

        <form action={saveAction} className="mt-4 space-y-4 border-t pt-4 text-sm">
          <input type="hidden" name="source" value="ai_parsed" />
          <input type="hidden" name="submit_mode" value={submitMode} />
          <input type="hidden" name="items_json" value={JSON.stringify(effectiveItems)} />

          <div>
            <label className="text-xs font-semibold text-slate-700">Pelanggan Terdeteksi *</label>
            <select
              name="customer_id"
              required
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
            >
              <option value="">-- Pilih Toko / Pelanggan --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.business_name || c.name} (Tier: {c.tier.toUpperCase()} • {c.payment_terms})
                </option>
              ))}
            </select>
          </div>

          {effectiveItems.length > 0 && (
            <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-slate-50">
              {effectiveItems.map((item) => (
                <div key={item.product_id} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900">[{item.sku}] {item.name}</div>
                    <div className="text-slate-600">
                      Harga Tier: {formatRupiah(item.unit_price)}/{item.unit} • Stok: {item.current_stock}
                    </div>
                  </div>
                  <input
                    type="number"
                    min={1}
                    value={item.qty}
                    onChange={(e) => {
                      const nextQty = Math.max(1, Number(e.target.value));
                      setItems((prev) => prev.map((x) => (x.product_id === item.product_id ? { ...x, qty: nextQty } : x)));
                    }}
                    className="w-20 rounded border border-slate-300 bg-white px-2 py-1 text-right font-semibold text-slate-900"
                  />
                  <span className="w-24 text-right font-bold text-slate-900">{formatRupiah(item.qty * item.unit_price)}</span>
                  <button
                    type="button"
                    onClick={() => setItems((prev) => prev.filter((x) => x.product_id !== item.product_id))}
                    className="rounded border border-red-300 bg-red-50 px-2 py-0.5 font-semibold text-red-700"
                  >
                    Hapus
                  </button>
                </div>
              ))}
            </div>
          )}

          {unmatched.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="font-semibold">Baris belum cocok dengan katalog SKU:</p>
              <ul className="mt-1 list-disc pl-4">
                {unmatched.map((u, idx) => <li key={idx}>{u}</li>)}
              </ul>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-700">Catatan Pesanan</label>
            <input name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" />
          </div>

          <div className="flex items-center justify-between rounded-lg bg-blue-50 px-4 py-3">
            <span className="text-xs font-semibold text-blue-800">Estimasi Total Draft Order</span>
            <span className="text-lg font-bold text-blue-900">{formatRupiah(totalAmount)}</span>
          </div>

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700">Batal</button>
            <button
              type="submit"
              onClick={() => setSubmitMode('draft')}
              disabled={isSaving || effectiveItems.length === 0 || !customerId}
              className="rounded-lg border border-blue-600 bg-blue-50 px-4 py-2 font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
            >
              Simpan Draft Order
            </button>
            <button
              type="submit"
              onClick={() => setSubmitMode('confirm')}
              disabled={isSaving || effectiveItems.length === 0 || !customerId}
              className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? 'Menyimpan...' : 'Simpan & Konfirmasi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
