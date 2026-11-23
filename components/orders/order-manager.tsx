'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import {
  createOrderAction,
  generateInvoiceForOrderAction,
  updateOrderStatusAction,
  type OrderActionState,
} from '@/actions/orders';
import { formatRupiah } from '@/lib/utils';
import type { Database } from '@/types/database.types';
import { AiOrderModal } from './ai-order-modal';

type OrderStatus = Database['public']['Enums']['order_status'];
type OrderSource = Database['public']['Enums']['order_source'];
type CustomerTier = Database['public']['Enums']['customer_tier'];

export type OrderCustomerOption = { id: string; name: string; business_name: string | null; tier: CustomerTier; payment_terms: string };
export type OrderProductOption = { id: string; sku: string; name: string; unit: string; selling_price: number; wholesale_price: number; current_stock: number };
export type OrderListItem = {
  id: string; order_number: string; order_date: string; status: OrderStatus; source: OrderSource;
  subtotal: number; discount: number; total_amount: number; notes: string | null;
  customer_name: string; customer_tier: string; items_count: number; invoice_number: string | null;
};

type CartItem = { product_id: string; sku: string; name: string; unit: string; qty: number; unit_price: number };

const STATUS_BADGE: Record<OrderStatus, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'bg-slate-200 text-slate-800' },
  confirmed: { label: 'Terkonfirmasi', cls: 'bg-blue-50 text-blue-700' },
  packed: { label: 'Dikemas', cls: 'bg-indigo-50 text-indigo-700' },
  shipped: { label: 'Dikirim', cls: 'bg-amber-50 text-amber-700' },
  completed: { label: 'Selesai', cls: 'bg-emerald-50 text-emerald-700' },
  cancelled: { label: 'Dibatalkan', cls: 'bg-red-50 text-red-700' },
};

export function OrderManager({ orders, customers, products }: { orders: OrderListItem[]; customers: OrderCustomerOption[]; products: OrderProductOption[] }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [qtyInput, setQtyInput] = useState(1);
  const [discountInput, setDiscountInput] = useState(0);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPendingAction, startTransition] = useTransition();
  const [createState, createAction, isCreating] = useActionState<OrderActionState, FormData>(createOrderAction, {});

  useEffect(() => {
    if (createState.success) {
      setIsModalOpen(false); setCart([]); setSelectedCustomerId(''); setSelectedProductId(''); setQtyInput(1); setDiscountInput(0);
      setNotice(createState.success);
    }
  }, [createState.success]);

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);
  const resolveTierPrice = (prod: OrderProductOption, tier?: CustomerTier) =>
    (tier === 'wholesale' || tier === 'agent') && prod.wholesale_price > 0 ? prod.wholesale_price : prod.selling_price;

  function mergeProductIntoCart(base: CartItem[], prod: OrderProductOption, qty: number): CartItem[] {
    const unitPrice = resolveTierPrice(prod, selectedCustomer?.tier);
    const exists = base.find((i) => i.product_id === prod.id);
    if (exists) return base.map((i) => (i.product_id === prod.id ? { ...i, qty: i.qty + qty, unit_price: unitPrice } : i));
    return [...base, { product_id: prod.id, sku: prod.sku, name: prod.name, unit: prod.unit, qty, unit_price: unitPrice }];
  }

  function handleAddCartItem() {
    const prod = products.find((p) => p.id === selectedProductId);
    if (!prod || qtyInput <= 0) return;
    setCart((prev) => mergeProductIntoCart(prev, prod, qtyInput));
    setSelectedProductId(''); setQtyInput(1);
  }

  const normalizedCart = cart.map((item) => {
    const prod = products.find((p) => p.id === item.product_id);
    return prod ? { ...item, unit_price: resolveTierPrice(prod, selectedCustomer?.tier) } : item;
  });
  const pendingProduct = products.find((p) => p.id === selectedProductId);
  const effectiveCart = pendingProduct && qtyInput > 0 ? mergeProductIntoCart(normalizedCart, pendingProduct, qtyInput) : normalizedCart;
  const cartTotal = Math.max(0, effectiveCart.reduce((s, i) => s + i.qty * i.unit_price, 0) - discountInput);

  const filteredOrders = orders.filter((o) => {
    const q = search.trim().toLowerCase();
    return (!q || o.order_number.toLowerCase().includes(q) || o.customer_name.toLowerCase().includes(q)) && (statusFilter === 'all' || o.status === statusFilter);
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pesanan Penjualan (Orders)</h1>
          <p className="mt-1 text-sm text-slate-600">Kelola pesanan B2B manual maupun ekstrak otomatis dari chat WhatsApp.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setIsAiModalOpen(true)} className="rounded-lg border border-emerald-600 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-100">
            ✨ AI Parser Chat WA
          </button>
          <button type="button" onClick={() => setIsModalOpen(true)} className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
            + Buat Pesanan Baru
          </button>
        </div>
      </div>

      {notice && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-xs font-bold underline">Tutup</button>
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 lg:flex-row">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nomor order atau pelanggan..." className="flex-1 rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900" />
        <div className="flex flex-wrap gap-2">
          {(['all', 'draft', 'confirmed', 'shipped', 'completed', 'cancelled'] as const).map((st) => (
            <button key={st} type="button" onClick={() => setStatusFilter(st)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${statusFilter === st ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}>
              {st === 'all' ? 'Semua' : STATUS_BADGE[st].label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-600">
            <tr>
              <th className="px-4 py-3">No. Order</th>
              <th className="px-4 py-3">Pelanggan</th>
              <th className="px-4 py-3 text-center">Item</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredOrders.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-600">Belum ada data pesanan.</td></tr>
            ) : (
              filteredOrders.map((ord) => {
                const badge = STATUS_BADGE[ord.status] ?? STATUS_BADGE.draft;
                return (
                  <tr key={ord.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-bold text-blue-600">{ord.order_number}</span>
                        {ord.source !== 'manual' && (
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-800">
                            {ord.source === 'whatsapp' ? 'WA' : 'AI'}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-600">{ord.order_date.slice(0, 10)}</div>
                      {ord.invoice_number && <div className="font-mono text-[11px] font-semibold text-emerald-700">{ord.invoice_number}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{ord.customer_name}</div>
                      <div className="text-[11px] uppercase text-slate-600">Tier: {ord.customer_tier}</div>
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-slate-700">{ord.items_count} SKU</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">{formatRupiah(ord.total_amount)}</td>
                    <td className="px-4 py-3 text-center"><span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.cls}`}>{badge.label}</span></td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex flex-wrap justify-end gap-1.5">
                        {ord.status === 'draft' && (
                          <button type="button" disabled={isPendingAction} onClick={() => startTransition(async () => { const r = await updateOrderStatusAction(ord.id, 'confirmed'); setNotice(r.success ?? r.error ?? null); })} className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700">
                            Konfirmasi
                          </button>
                        )}
                        {ord.status === 'confirmed' && (
                          <button type="button" disabled={isPendingAction} onClick={() => startTransition(async () => { const r = await updateOrderStatusAction(ord.id, 'shipped'); setNotice(r.success ?? r.error ?? null); })} className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                            Kirim
                          </button>
                        )}
                        {ord.status === 'shipped' && (
                          <button type="button" disabled={isPendingAction} onClick={() => startTransition(async () => { const r = await updateOrderStatusAction(ord.id, 'completed'); setNotice(r.success ?? r.error ?? null); })} className="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                            Selesai
                          </button>
                        )}
                        {!ord.invoice_number && ord.status !== 'draft' && ord.status !== 'cancelled' && (
                          <button type="button" disabled={isPendingAction} onClick={() => startTransition(async () => { const r = await generateInvoiceForOrderAction(ord.id); setNotice(r.success ?? r.error ?? null); })} className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white">
                            Terbitkan Invoice
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <AiOrderModal isOpen={isAiModalOpen} onClose={() => setIsAiModalOpen(false)} customers={customers} products={products} onSuccess={(msg) => setNotice(msg)} />

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-bold text-slate-900">Buat Pesanan Penjualan Baru</h2>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-600">✕</button>
            </div>
            {createState.error && <div className="mb-3 rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-800">{createState.error}</div>}
            <form action={createAction} className="space-y-4 text-sm">
              <input type="hidden" name="items_json" value={JSON.stringify(effectiveCart)} />
              <div>
                <label className="text-xs font-semibold text-slate-700">Pilih Pelanggan *</label>
                <select name="customer_id" required value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900">
                  <option value="">-- Pilih Toko / Pelanggan --</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.business_name || c.name} (Tier: {c.tier.toUpperCase()} • {c.payment_terms})</option>)}
                </select>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="mb-2 text-xs font-semibold text-slate-700">Tambah Produk</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <select value={selectedProductId} onChange={(e) => setSelectedProductId(e.target.value)} className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900">
                    <option value="">-- Pilih Produk --</option>
                    {products.map((p) => <option key={p.id} value={p.id}>[{p.sku}] {p.name} (Stok: {p.current_stock} {p.unit} • {formatRupiah(resolveTierPrice(p, selectedCustomer?.tier))})</option>)}
                  </select>
                  <input type="number" min={1} value={qtyInput} onChange={(e) => setQtyInput(Math.max(1, Number(e.target.value)))} className="w-24 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900" />
                  <button type="button" onClick={handleAddCartItem} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white">+ Tambah</button>
                </div>
                {normalizedCart.length > 0 && (
                  <div className="mt-3 divide-y divide-slate-200 rounded border border-slate-200 bg-white">
                    {normalizedCart.map((item) => (
                      <div key={item.product_id} className="flex items-center justify-between px-3 py-2 text-xs">
                        <div><div className="font-semibold text-slate-900">{item.name}</div><div className="text-slate-600">{item.qty} {item.unit} × {formatRupiah(item.unit_price)}</div></div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-slate-900">{formatRupiah(item.qty * item.unit_price)}</span>
                          <button type="button" onClick={() => setCart((prev) => prev.filter((x) => x.product_id !== item.product_id))} className="rounded border border-red-300 bg-red-50 px-2 py-0.5 font-semibold text-red-700">Hapus</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-semibold text-slate-700">Diskon (Rp)</label><input name="discount" type="number" min={0} value={discountInput} onChange={(e) => setDiscountInput(Math.max(0, Number(e.target.value)))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></div>
                <div><label className="text-xs font-semibold text-slate-700">Catatan</label><input name="notes" placeholder="Opsional..." className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900" /></div>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-blue-50 px-4 py-3"><span className="text-xs font-semibold text-blue-800">Total Pesanan</span><span className="text-lg font-bold text-blue-900">{formatRupiah(cartTotal)}</span></div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700">Batal</button>
                <button type="submit" disabled={isCreating || effectiveCart.length === 0 || !selectedCustomerId} className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{isCreating ? 'Menyimpan...' : 'Simpan Pesanan'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default OrderManager;
