'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import {
  createCustomerAction,
  toggleCustomerStatusAction, deleteCustomerAction,
  updateCustomerAction,
  type CustomerActionState,
} from '@/actions/customers';
import { formatRupiah } from '@/lib/utils';
import type { Database } from '@/types/database.types';

type CustomerTier = Database['public']['Enums']['customer_tier'];
type PaymentTerm = Database['public']['Enums']['payment_term'];

export type CustomerItem = {
  id: string;
  name: string;
  business_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  tier: CustomerTier;
  payment_terms: PaymentTerm;
  credit_limit: number;
  is_active: boolean;
  active_receivable?: number;
  outstanding_receivable?: number;
  remaining_credit?: number;
};

const TIERS: CustomerTier[] = ['retail', 'wholesale', 'agent'];

const TIER_LABELS: Record<CustomerTier, string> = {
  retail: 'Retail',
  wholesale: 'Grosir',
  agent: 'Agen',
};

const TERMS: PaymentTerm[] = ['COD', 'NET_7', 'NET_14', 'NET_30', 'NET_60'];
const initialState: CustomerActionState = {};

export function CustomerManager({ customers }: { customers: CustomerItem[] }) {
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<'all' | CustomerTier>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerItem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isToggling, startToggle] = useTransition();

  const [createState, createAction, isCreating] = useActionState(
    createCustomerAction,
    initialState
  );
  const [updateState, updateAction, isUpdating] = useActionState(
    updateCustomerAction,
    initialState
  );

  useEffect(() => {
    if (createState.success) {
      setIsCreateOpen(false);
      setNotice(createState.success);
    }
  }, [createState.success]);

  useEffect(() => {
    if (updateState.success) {
      setEditing(null);
      setNotice(updateState.success);
    }
  }, [updateState.success]);

  const filtered = customers.filter((c) => {
    const q = search.trim().toLowerCase();
    const matchText =
      !q ||
      c.name.toLowerCase().includes(q) ||
      (c.business_name ?? '').toLowerCase().includes(q) ||
      (c.phone ?? '').toLowerCase().includes(q);
    return matchText && (tierFilter === 'all' || c.tier === tierFilter);
  });

  const totalReceivable = customers.reduce(
    (sum, c) => sum + (c.active_receivable ?? c.outstanding_receivable ?? 0),
    0
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Data Pelanggan & Mitra B2B
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Kelola tier harga grosir, termin pembayaran (TOP), dan plafon kredit toko.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          + Tambah Pelanggan
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-slate-600">Total Pelanggan</p>
          <p className="mt-1 text-xl font-bold text-slate-900">{customers.length} Mitra</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-slate-600">Piutang Berjalan</p>
          <p className="mt-1 text-xl font-bold text-amber-600">{formatRupiah(totalReceivable)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase text-slate-600">Total Plafon Kredit</p>
          <p className="mt-1 text-xl font-bold text-blue-600">
            {formatRupiah(customers.reduce((s, c) => s + Number(c.credit_limit || 0), 0))}
          </p>
        </div>
      </div>

      {notice && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-xs font-bold">
            Tutup
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 lg:flex-row">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nama toko, PIC, atau telepon..."
          className="flex-1 rounded-lg border border-slate-300 px-3.5 py-2 text-sm"
        />
        <div className="flex flex-wrap gap-2">
          {(['all', ...TIERS] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTierFilter(t)}
              className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                tierFilter === t ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {t === 'all' ? 'Semua' : TIER_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Toko / PIC</th>
              <th className="px-4 py-3">Kontak</th>
              <th className="px-4 py-3 text-center">Tier</th>
              <th className="px-4 py-3 text-center">Termin</th>
              <th className="px-4 py-3 text-right">Piutang / Plafon</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-600">
                  Belum ada data pelanggan.
                </td>
              </tr>
            ) : (
              filtered.map((c) => {
                const debt = c.active_receivable ?? c.outstanding_receivable ?? 0;
                return (
                  <tr key={c.id} className={!c.is_active ? 'opacity-50' : 'hover:bg-slate-50'}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{c.business_name || c.name}</div>
                      {c.business_name && <div className="text-xs text-slate-500">PIC: {c.name}</div>}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{c.phone ? `+${c.phone}` : '-'}</td>
                    <td className="px-4 py-3 text-center text-xs font-bold uppercase text-blue-700">
                      {TIER_LABELS[c.tier] ?? c.tier}
                    </td>
                    <td className="px-4 py-3 text-center font-mono text-xs">{c.payment_terms.replace('_', ' ')}</td>
                    <td className="px-4 py-3 text-right text-xs">
                      <div className="font-bold text-amber-600">{formatRupiah(debt)}</div>
                      <div className="text-slate-600">Limit: {formatRupiah(c.credit_limit)}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditing(c)}
                          className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={isToggling}
                          onClick={() =>
                            startToggle(async () => {
                              const res = await toggleCustomerStatusAction(c.id, !c.is_active);
                              setNotice(res.success ?? res.error ?? null);
                            })
                          }
                          className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${c.is_active ? 'border-orange-300 bg-orange-50 text-orange-800 hover:bg-orange-100' : 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'}`}>{c.is_active ? 'Nonaktif' : 'Aktifkan'}</button><button type="button" onClick={() => startToggle(async () => { if (confirm("Hapus pelanggan ini?")) { const r = await deleteCustomerAction(c.id); setNotice(r.success ?? r.error ?? null); } })} className="rounded-lg border border-red-300 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 transition hover:bg-red-100">Hapus</button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {(isCreateOpen || editing) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-bold">
                {editing ? 'Edit Pelanggan' : 'Tambah Pelanggan Baru'}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setIsCreateOpen(false);
                  setEditing(null);
                }}
                className="text-slate-600 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            {(createState.error || updateState.error) && (
              <div className="mb-3 rounded bg-red-50 p-3 text-xs text-red-700">
                {editing ? updateState.error : createState.error}
              </div>
            )}
            <form action={editing ? updateAction : createAction} className="space-y-3 text-sm">
              {editing && <input type="hidden" name="customer_id" value={editing.id} />}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Nama Toko / Usaha</label>
                  <input
                    name="business_name"
                    defaultValue={editing?.business_name ?? ''}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Nama PIC *</label>
                  <input
                    name="name"
                    required
                    defaultValue={editing?.name ?? ''}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600">No. WhatsApp</label>
                  <input
                    name="phone"
                    defaultValue={editing?.phone ?? ''}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Email</label>
                  <input
                    name="email"
                    type="email"
                    defaultValue={editing?.email ?? ''}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600">Tier Harga</label>
                  <select
                    name="tier"
                    defaultValue={editing?.tier ?? 'wholesale'}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                  >
                    {TIERS.map((t) => (
                      <option key={t} value={t}>{TIER_LABELS[t]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Termin (TOP)</label>
                  <select
                    name="payment_terms"
                    defaultValue={editing?.payment_terms ?? 'COD'}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                  >
                    {TERMS.map((t) => (
                      <option key={t} value={t}>{t.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600">Plafon Kredit</label>
                  <input
                    name="credit_limit"
                    type="number"
                    min={0}
                    defaultValue={editing?.credit_limit ?? 0}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600">Alamat Pengiriman</label>
                <textarea
                  name="address"
                  rows={2}
                  defaultValue={editing?.address ?? ''}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateOpen(false);
                    setEditing(null);
                  }}
                  className="rounded-lg border px-4 py-2 text-slate-600"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isCreating || isUpdating}
                  className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
                >
                  {isCreating || isUpdating ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomerManager;
