'use client';

import { useActionState, useEffect, useState } from 'react';
import {
  createProductAction,
  updateProductAction, toggleProductStatusAction, deleteProductAction,
  type ProductActionState,
} from '@/actions/products';
import { formatRupiah } from '@/lib/utils';
import type { Database } from '@/types/database.types';

type ProductRow = Database['public']['Tables']['products']['Row'];

type ProductManagerProps = {
  products: ProductRow[];
  initialQuery: string;
  initialFilter: string;
};

const initialState: ProductActionState = {};

export function ProductManager({
  products,
  initialQuery,
  initialFilter,
}: ProductManagerProps) {
  const [search, setSearch] = useState(initialQuery);
  const [filter, setFilter] = useState(initialFilter);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null);

  const [createState, createAction, isCreating] = useActionState(
    createProductAction,
    initialState
  );
  const [updateState, updateAction, isUpdating] = useActionState(
    updateProductAction,
    initialState
  );

  const activeState = editingProduct ? updateState : createState;
  const isSubmitting = editingProduct ? isUpdating : isCreating;

  useEffect(() => {
    if (createState.success || updateState.success) {
      setIsModalOpen(false);
      setEditingProduct(null);
    }
  }, [createState.success, updateState.success]);

  function openCreateModal() {
    setEditingProduct(null);
    setIsModalOpen(true);
  }

  function openEditModal(product: ProductRow) {
    setEditingProduct(product);
    setIsModalOpen(true);
  }

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      !search.trim() ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase()) ||
      (p.category ?? '').toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;
    if (filter === 'low_stock') return p.current_stock <= p.min_stock_alert;
    if (filter === 'inactive') return !p.is_active;
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Header & Action Bar */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Katalog Produk</h1>
          <p className="mt-1 text-sm text-slate-500">
            Kelola SKU, harga modal, harga grosir, harga normal, dan batas stok minimum.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-2xs transition hover:bg-blue-700"
        >
          <span>+ Tambah Produk</span>
        </button>
      </div>

      {/* Notifikasi Sukses */}
      {(createState.success || updateState.success) && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {editingProduct ? updateState.success : createState.success ?? updateState.success}
        </div>
      )}

      {/* Search & Filter Controls */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nama produk, SKU, atau kategori..."
          className="flex-1 rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
        />
        <div className="flex gap-2">
          {[
            { id: 'all', label: `Semua (${products.length})` },
            {
              id: 'low_stock',
              label: `Stok Menipis (${products.filter((p) => p.current_stock <= p.min_stock_alert).length})`,
            },
            {
              id: 'inactive',
              label: `Nonaktif (${products.filter((p) => !p.is_active).length})`,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                filter === tab.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Products Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3.5">SKU & Produk</th>
                <th className="px-4 py-3.5 text-right">Harga Modal</th>
                <th className="px-4 py-3.5 text-right">Harga Grosir</th>
                <th className="px-4 py-3.5 text-right">Harga Normal</th>
                <th className="px-4 py-3.5 text-right">Margin Grosir</th>
                <th className="px-4 py-3.5 text-right">Stok</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-4 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-600">
                    Belum ada data produk yang sesuai filter.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => {
                  const isLowStock = product.current_stock <= product.min_stock_alert;
                  const marginAmount = product.wholesale_price - product.cost_price;
                  const marginPct =
                    product.wholesale_price > 0
                      ? ((marginAmount / product.wholesale_price) * 100).toFixed(1)
                      : '0.0';

                  return (
                    <tr key={product.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3.5">
                        <div className="font-mono text-xs font-semibold text-blue-600">
                          {product.sku}
                        </div>
                        <div className="font-medium text-slate-900">{product.name}</div>
                        {product.category && (
                          <div className="text-xs text-slate-600">{product.category}</div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right text-slate-600">
                        {formatRupiah(product.cost_price)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-semibold text-slate-900">
                        {formatRupiah(product.wholesale_price)}
                      </td>
                      <td className="px-4 py-3.5 text-right text-slate-600">
                        {formatRupiah(product.selling_price)}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                            marginAmount >= 0
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-red-50 text-red-700'
                          }`}
                        >
                          {marginPct}%
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            isLowStock
                              ? 'bg-red-100 text-red-700'
                              : 'bg-slate-100 text-slate-800'
                          }`}
                        >
                          {product.current_stock} {product.unit}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                            product.is_active
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {product.is_active ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => openEditModal(product)}
                          className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
                        >
                          Edit</button> <button type="button" onClick={async () => { await toggleProductStatusAction(product.id, !product.is_active); }} className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${product.is_active ? 'border-orange-300 bg-orange-50 text-orange-800 hover:bg-orange-100' : 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'}`}>{product.is_active ? 'Nonaktif' : 'Aktifkan'}</button> <button type="button" onClick={async () => { if (confirm("Hapus produk ini?")) { const r = await deleteProductAction(product.id); if (r?.error) alert(r.error); } }} className="rounded-lg border border-red-300 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-100">Hapus</button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tambah / Edit Produk */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-lg font-bold text-slate-900">
                {editingProduct ? 'Edit Produk' : 'Tambah Produk Baru'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1 text-slate-600 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {activeState.error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {activeState.error}
              </div>
            )}

            <form
              action={editingProduct ? updateAction : createAction}
              className="space-y-4"
            >
              {editingProduct && (
                <input type="hidden" name="id" value={editingProduct.id} />
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600">
                    Kode SKU *
                  </label>
                  <input
                    name="sku"
                    type="text"
                    required
                    defaultValue={editingProduct?.sku ?? ''}
                    placeholder="BRG-001"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm uppercase focus:border-blue-500 focus:outline-none"
                  />
                  {activeState.fieldErrors?.sku && (
                    <p className="mt-1 text-xs text-red-600">
                      {activeState.fieldErrors.sku[0]}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600">
                    Satuan Dasar *
                  </label>
                  <input
                    name="unit"
                    type="text"
                    required
                    defaultValue={editingProduct?.unit ?? 'dus'}
                    placeholder="dus / karton / pcs"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                  {activeState.fieldErrors?.unit && (
                    <p className="mt-1 text-xs text-red-600">
                      {activeState.fieldErrors.unit[0]}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600">
                  Nama Produk *
                </label>
                <input
                  name="name"
                  type="text"
                  required
                  defaultValue={editingProduct?.name ?? ''}
                  placeholder="Minyak Goreng Kemasan 2L (1 Dus isi 6)"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
                {activeState.fieldErrors?.name && (
                  <p className="mt-1 text-xs text-red-600">
                    {activeState.fieldErrors.name[0]}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600">
                  Kategori
                </label>
                <input
                  name="category"
                  type="text"
                  defaultValue={editingProduct?.category ?? ''}
                  placeholder="Sembako / Minuman / FMCG"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600">
                    Harga Modal (HPP) *
                  </label>
                  <input
                    name="cost_price"
                    type="number"
                    min="0"
                    step="1"
                    required
                    defaultValue={editingProduct?.cost_price ?? 0}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600">
                    Harga Grosir *
                  </label>
                  <input
                    name="wholesale_price"
                    type="number"
                    min="0"
                    step="1"
                    required
                    defaultValue={editingProduct?.wholesale_price ?? 0}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600">
                    Harga Normal *
                  </label>
                  <input
                    name="selling_price"
                    type="number"
                    min="0"
                    step="1"
                    required
                    defaultValue={editingProduct?.selling_price ?? 0}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600">
                    Batas Peringatan Stok Minimum
                  </label>
                  <input
                    name="min_stock_alert"
                    type="number"
                    min="0"
                    defaultValue={editingProduct?.min_stock_alert ?? 5}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>

                {!editingProduct ? (
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-600">
                      Stok Awal Gudang
                    </label>
                    <input
                      name="initial_stock"
                      type="number"
                      min="0"
                      defaultValue={0}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold uppercase text-slate-600">
                      Status Produk
                    </label>
                    <select
                      name="is_active"
                      defaultValue={editingProduct.is_active ? 'true' : 'false'}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    >
                      <option value="true">Aktif (Bisa Dipesan)</option>
                      <option value="false">Nonaktif / Arsip</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSubmitting
                    ? 'Menyimpan...'
                    : editingProduct
                      ? 'Simpan Perubahan'
                      : 'Simpan Produk'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}