'use client';

import { useActionState, useState } from 'react';
import {
  recordInventoryMovementAction,
  type InventoryActionState,
} from '@/actions/inventory';

type ProductOption = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  current_stock: number;
};

const initialState: InventoryActionState = {};

export function StockMovementForm({ products }: { products: ProductOption[] }) {
  const [state, formAction, isPending] = useActionState(
    recordInventoryMovementAction,
    initialState
  );
  const [selectedProductId, setSelectedProductId] = useState(
    products[0]?.id ?? ''
  );
  const [movementType, setMovementType] = useState<'in' | 'adjustment'>('in');
  const [qtyInput, setQtyInput] = useState<string>('10');

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const parsedQty = parseInt(qtyInput || '0', 10) || 0;
  const projectedStock = selectedProduct
    ? selectedProduct.current_stock + parsedQty
    : 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
      <h2 className="text-base font-bold text-slate-900">Catat Mutasi Stok</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        Gunakan <strong>Stok Masuk</strong> untuk penerimaan dari supplier, atau{' '}
        <strong>Penyesuaian</strong> untuk selisih stok opname.
      </p>

      {state.error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {state.error}
        </div>
      )}

      {state.success && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
          {state.success}
        </div>
      )}

      {products.length === 0 ? (
        <div className="mt-4 rounded-lg bg-slate-50 p-4 text-xs text-slate-500">
          Belum ada produk aktif. Tambahkan produk di menu <strong>Products</strong> terlebih dahulu.
        </div>
      ) : (
        <form action={formAction} className="mt-4 space-y-4">
          {/* Pilihan Jenis Mutasi */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setMovementType('in');
                if (parsedQty < 0) setQtyInput(String(Math.abs(parsedQty)));
              }}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                movementType === 'in'
                  ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              + Stok Masuk
            </button>
            <button
              type="button"
              onClick={() => setMovementType('adjustment')}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                movementType === 'adjustment'
                  ? 'border-amber-600 bg-amber-50 text-amber-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              ± Opname / Koreksi
            </button>
          </div>
          <input type="hidden" name="type" value={movementType} />
          <input
            type="hidden"
            name="reference_type"
            value={movementType === 'in' ? 'purchase' : 'stock_opname'}
          />

          {/* Pilih Produk */}
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600">
              Produk *
            </label>
            <select
              name="product_id"
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
            >
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  [{product.sku}] {product.name} (Sisa: {product.current_stock}{' '}
                  {product.unit})
                </option>
              ))}
            </select>
            {state.fieldErrors?.product_id && (
              <p className="mt-1 text-xs text-red-600">
                {state.fieldErrors.product_id[0]}
              </p>
            )}
          </div>

          {/* Jumlah */}
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600">
              {movementType === 'in'
                ? `Jumlah Masuk (${selectedProduct?.unit ?? 'unit'}) *`
                : `Selisih Koreksi (+ atau -) *`}
            </label>
            <input
              name="qty"
              type="number"
              required
              min={movementType === 'in' ? 1 : undefined}
              value={qtyInput}
              onChange={(e) => setQtyInput(e.target.value)}
              placeholder={movementType === 'in' ? '50' : '-2 atau 5'}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
            />
            {state.fieldErrors?.qty && (
              <p className="mt-1 text-xs text-red-600">
                {state.fieldErrors.qty[0]}
              </p>
            )}

            {selectedProduct && (
              <p className="mt-1.5 text-xs text-slate-500">
                Stok saat ini: <strong>{selectedProduct.current_stock}</strong> →
                Estimasi setelah simpan:{' '}
                <strong
                  className={
                    projectedStock < 0 ? 'text-red-600' : 'text-blue-600'
                  }
                >
                  {projectedStock} {selectedProduct.unit}
                </strong>
              </p>
            )}
          </div>

          {/* Catatan / Nomor Surat Jalan Supplier */}
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-600">
              Catatan / No. PO Supplier
            </label>
            <textarea
              name="notes"
              rows={2}
              placeholder={
                movementType === 'in'
                  ? 'Contoh: Pembelian dari PT Indofood - SJ #8821'
                  : 'Contoh: Hasil stok opname bulanan (2 dus rusak)'
              }
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? 'Menyimpan Mutasi...' : 'Simpan Mutasi Stok'}
          </button>
        </form>
      )}
    </div>
  );
}