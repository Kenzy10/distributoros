'use client';

import { useActionState, useEffect, useState } from 'react';
import {
  recordPaymentAction,
  type InvoiceActionState,
} from '@/actions/invoices';
import { formatRupiah } from '@/lib/utils';
import type { Database } from '@/types/database.types';

type InvoiceStatus = Database['public']['Enums']['invoice_status'];
type PaymentMethod = Database['public']['Enums']['payment_method'];

export type InvoicePaymentItem = {
  id: string;
  amount: number;
  payment_method: string;
  payment_date: string;
  notes: string | null;
  created_at: string;
};

export type InvoiceWithDetails = {
  id: string;
  invoice_number: string;
  status: InvoiceStatus;
  due_date: string;
  total_amount: number;
  paid_amount: number;
  notes: string | null;
  created_at: string;
  order: {
    id: string;
    order_number: string;
  } | null;
  customer: {
    id: string;
    name: string;
    business_name: string | null;
    phone: string | null;
    payment_terms: string;
  } | null;
  payments: InvoicePaymentItem[];
};

const METHOD_LABELS: Record<PaymentMethod, string> = {
  bank_transfer: 'Transfer Bank',
  cash: 'Tunai / COD',
  giro: 'Cek / Bilyet Giro',
  qris: 'QRIS',
  other: 'Lainnya',
};

function formatShortDateID(dateStr: string): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`);
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function getTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDaysDiffFromToday(dueDateStr: string): number {
  const today = new Date(`${getTodayISO()}T00:00:00`);
  const due = new Date(`${dueDateStr}T00:00:00`);
  return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function getEffectiveStatus(invoice: InvoiceWithDetails): InvoiceStatus {
  if (
    (invoice.status === 'unpaid' || invoice.status === 'partial') &&
    getDaysDiffFromToday(invoice.due_date) < 0
  ) {
    return 'overdue';
  }
  return invoice.status;
}

const STATUS_BADGES: Record<InvoiceStatus, { label: string; style: string }> = {
  unpaid: {
    label: 'Belum Bayar',
    style: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  partial: {
    label: 'Cicilan / Sebagian',
    style: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  overdue: {
    label: 'Jatuh Tempo',
    style: 'bg-red-50 text-red-700 border-red-200',
  },
  paid: {
    label: 'Lunas',
    style: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  void: {
    label: 'Dibatalkan (Void)',
    style: 'bg-slate-100 text-slate-500 border-slate-200',
  },
};

const initialState: InvoiceActionState = {};

export function InvoiceManager({
  invoices,
}: {
  invoices: InvoiceWithDetails[];
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [payingInvoice, setPayingInvoice] =
    useState<InvoiceWithDetails | null>(null);
  const [detailInvoice, setDetailInvoice] =
    useState<InvoiceWithDetails | null>(null);
  const [paymentAmountInput, setPaymentAmountInput] = useState<string>('');

  const [paymentState, paymentAction, isRecording] = useActionState(
    recordPaymentAction,
    initialState
  );

  useEffect(() => {
    if (paymentState.success) {
      setPayingInvoice(null);
      setPaymentAmountInput('');
    }
  }, [paymentState.success]);

  function openPaymentModal(invoice: InvoiceWithDetails) {
    const remaining = Math.max(0, invoice.total_amount - invoice.paid_amount);
    setPayingInvoice(invoice);
    setPaymentAmountInput(String(remaining));
  }

  // Kalkulasi KPI Piutang
  const openInvoices = invoices.filter((inv) => {
    const eff = getEffectiveStatus(inv);
    return eff === 'unpaid' || eff === 'partial' || eff === 'overdue';
  });

  const totalOutstanding = openInvoices.reduce(
    (sum, inv) => sum + Math.max(0, inv.total_amount - inv.paid_amount),
    0
  );

  const overdueInvoices = invoices.filter(
    (inv) => getEffectiveStatus(inv) === 'overdue'
  );

  const totalOverdueAmount = overdueInvoices.reduce(
    (sum, inv) => sum + Math.max(0, inv.total_amount - inv.paid_amount),
    0
  );

  const totalCollected = invoices
    .filter((inv) => inv.status !== 'void')
    .reduce((sum, inv) => sum + inv.paid_amount, 0);

  // Filter daftar tagihan
  const filteredInvoices = invoices.filter((inv) => {
    const q = search.trim().toLowerCase();
    const customerLabel =
      inv.customer?.business_name || inv.customer?.name || '';
    const orderNumber = inv.order?.order_number || '';

    const matchesSearch =
      !q ||
      inv.invoice_number.toLowerCase().includes(q) ||
      orderNumber.toLowerCase().includes(q) ||
      customerLabel.toLowerCase().includes(q);

    if (!matchesSearch) return false;

    const effStatus = getEffectiveStatus(inv);
    if (statusFilter === 'all') return true;
    return effStatus === statusFilter;
  });

  function buildWhatsAppReminderUrl(inv: InvoiceWithDetails): string | null {
    const phone = inv.customer?.phone;
    if (!phone) return null;

    const remaining = Math.max(0, inv.total_amount - inv.paid_amount);
    const recipient =
      inv.customer?.business_name || inv.customer?.name || 'Mitra';
    const message = [
      `Halo *${recipient}*,`,
      `Berikut pengingat tagihan *${inv.invoice_number}*${inv.order ? ` (Ref: ${inv.order.order_number})` : ''}:`,
      `• Total Tagihan: ${formatRupiah(inv.total_amount)}`,
      `• Sudah Dibayar: ${formatRupiah(inv.paid_amount)}`,
      `• *Sisa Tagihan: ${formatRupiah(remaining)}*`,
      `• Jatuh Tempo: ${formatShortDateID(inv.due_date)}`,
      ``,
      `Mohon konfirmasi bukti transfer setelah melakukan pembayaran. Terima kasih.`,
    ].join('\n');

    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Tagihan & Pembayaran (Invoices)
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Pantau jatuh tempo piutang pelanggan, catat pembayaran cicilan maupun
          pelunasan, dan kirim pengingat tagihan.
        </p>
      </div>

      {/* Ringkasan KPI Piutang */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-600">
            Total Piutang Belum Lunas
          </p>
          <p className="mt-1 text-xl font-bold text-amber-600">
            {formatRupiah(totalOutstanding)}
          </p>
          <p className="mt-0.5 text-xs text-slate-600">
            Dari {openInvoices.length} tagihan aktif
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-600">
            Lewat Jatuh Tempo (Overdue)
          </p>
          <p className="mt-1 text-xl font-bold text-red-600">
            {formatRupiah(totalOverdueAmount)}
          </p>
          <p className="mt-0.5 text-xs text-slate-600">
            {overdueInvoices.length} tagihan perlu penagihan segera
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-600">
            Total Pembayaran Masuk
          </p>
          <p className="mt-1 text-xl font-bold text-emerald-600">
            {formatRupiah(totalCollected)}
          </p>
          <p className="mt-0.5 text-xs text-slate-600">
            Akumulasi pelunasan & cicilan diterima
          </p>
        </div>
      </div>

      {/* Notifikasi Sukses */}
      {paymentState.success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {paymentState.success}
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 lg:flex-row lg:items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nomor invoice (INV-...), nomor order (ORD-...), atau pelanggan..."
          className="flex-1 rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none"
        />
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'all', label: `Semua (${invoices.length})` },
            { id: 'unpaid', label: 'Belum Bayar' },
            { id: 'partial', label: 'Cicilan' },
            {
              id: 'overdue',
              label: `Jatuh Tempo (${overdueInvoices.length})`,
            },
            { id: 'paid', label: 'Lunas' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                statusFilter === tab.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabel Tagihan */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3.5">No. Invoice & Order</th>
                <th className="px-4 py-3.5">Pelanggan</th>
                <th className="px-4 py-3.5">Jatuh Tempo</th>
                <th className="px-4 py-3.5 text-right">Total & Terbayar</th>
                <th className="px-4 py-3.5 text-right">Sisa Tagihan</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-4 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-slate-600"
                  >
                    Belum ada data tagihan yang sesuai filter.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const effStatus = getEffectiveStatus(inv);
                  const badge = STATUS_BADGES[effStatus];
                  const remaining = Math.max(
                    0,
                    inv.total_amount - inv.paid_amount
                  );
                  const daysDiff = getDaysDiffFromToday(inv.due_date);
                  const isPayable =
                    effStatus !== 'paid' && effStatus !== 'void';
                  const waUrl = isPayable ? buildWhatsAppReminderUrl(inv) : null;

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3.5">
                        <div className="font-mono text-xs font-bold text-blue-600">
                          {inv.invoice_number}
                        </div>
                        <div className="font-mono text-[11px] text-slate-600">
                          Ref: {inv.order?.order_number ?? '-'}
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-900">
                          {inv.customer?.business_name ||
                            inv.customer?.name ||
                            'Pelanggan'}
                        </div>
                        {inv.customer && (
                          <div className="text-xs text-slate-500">
                            Termin:{' '}
                            {inv.customer.payment_terms.replace('_', ' ')}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="text-xs font-medium text-slate-800">
                          {formatShortDateID(inv.due_date)}
                        </div>
                        {isPayable && (
                          <div
                            className={`text-[11px] font-medium ${
                              daysDiff < 0
                                ? 'text-red-600'
                                : daysDiff === 0
                                  ? 'text-amber-600'
                                  : 'text-slate-600'
                            }`}
                          >
                            {daysDiff < 0
                              ? `Terlambat ${Math.abs(daysDiff)} hari`
                              : daysDiff === 0
                                ? 'Jatuh tempo hari ini'
                                : `Sisa ${daysDiff} hari`}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <div className="font-medium text-slate-900">
                          {formatRupiah(inv.total_amount)}
                        </div>
                        <div className="text-[11px] text-emerald-600">
                          Dibayar: {formatRupiah(inv.paid_amount)}
                        </div>
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <span
                          className={`font-bold ${
                            remaining > 0 ? 'text-slate-900' : 'text-slate-600'
                          }`}
                        >
                          {formatRupiah(remaining)}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badge.style}`}
                        >
                          {badge.label}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <div className="inline-flex flex-wrap justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setDetailInvoice(inv)}
                            className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            Riwayat ({inv.payments.length})
                          </button>

                          {waUrl && (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                              title="Kirim pengingat tagihan via WhatsApp"
                            >
                              WA Tagih
                            </a>
                          )}

                          {isPayable && (
                            <button
                              type="button"
                              onClick={() => openPaymentModal(inv)}
                              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                            >
                              Catat Bayar
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
      </div>

      {/* Modal Catat Pembayaran / Cicilan */}
      {payingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="font-mono text-xs font-bold text-blue-600">
                  {payingInvoice.invoice_number}
                </div>
                <h2 className="text-lg font-bold text-slate-900">
                  Catat Pembayaran Tagihan
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setPayingInvoice(null)}
                className="rounded-lg p-1 text-slate-600 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {/* Ringkasan Saldo Tagihan */}
            {(() => {
              const remaining = Math.max(
                0,
                payingInvoice.total_amount - payingInvoice.paid_amount
              );
              return (
                <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs">
                  <div className="font-semibold text-slate-900">
                    {payingInvoice.customer?.business_name ||
                      payingInvoice.customer?.name}
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 border-t border-slate-200 pt-2">
                    <div>
                      <span className="text-slate-600">Total Tagihan</span>
                      <div className="font-semibold text-slate-800">
                        {formatRupiah(payingInvoice.total_amount)}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-600">Terbayar</span>
                      <div className="font-semibold text-emerald-600">
                        {formatRupiah(payingInvoice.paid_amount)}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-600">Sisa Tagihan</span>
                      <div className="font-bold text-amber-600">
                        {formatRupiah(remaining)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {paymentState.error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {paymentState.error}
              </div>
            )}

            <form action={paymentAction} className="space-y-4">
              <input
                type="hidden"
                name="invoice_id"
                value={payingInvoice.id}
              />

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold uppercase text-slate-600">
                    Nominal Pembayaran (Rp) *
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setPaymentAmountInput(
                        String(
                          Math.max(
                            0,
                            payingInvoice.total_amount -
                              payingInvoice.paid_amount
                          )
                        )
                      )
                    }
                    className="text-xs font-semibold text-blue-600 hover:underline"
                  >
                    Isi Lunas Penuh
                  </button>
                </div>
                <input
                  name="amount"
                  type="number"
                  min={1}
                  max={Math.max(
                    1,
                    payingInvoice.total_amount - payingInvoice.paid_amount
                  )}
                  step="any"
                  required
                  value={paymentAmountInput}
                  onChange={(e) => setPaymentAmountInput(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-900 focus:border-blue-500 focus:outline-none"
                />
                {paymentState.fieldErrors?.amount && (
                  <p className="mt-1 text-xs text-red-600">
                    {paymentState.fieldErrors.amount[0]}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600">
                    Metode Pembayaran *
                  </label>
                  <select
                    name="payment_method"
                    defaultValue="bank_transfer"
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    {(Object.keys(METHOD_LABELS) as PaymentMethod[]).map(
                      (method) => (
                        <option key={method} value={method}>
                          {METHOD_LABELS[method]}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-600">
                    Tanggal Pembayaran *
                  </label>
                  <input
                    name="payment_date"
                    type="date"
                    required
                    defaultValue={getTodayISO()}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                  {paymentState.fieldErrors?.payment_date && (
                    <p className="mt-1 text-xs text-red-600">
                      {paymentState.fieldErrors.payment_date[0]}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600">
                  Nomor Referensi / Bukti Transfer / No. Giro
                </label>
                <input
                  name="reference_number"
                  type="text"
                  placeholder="Contoh: TRF-BCA-99281 atau BG-00412"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-600">
                  Catatan Pembayaran
                </label>
                <input
                  name="notes"
                  type="text"
                  placeholder="Contoh: Pembayaran termin tahap 1 via BCA"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setPayingInvoice(null)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isRecording}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isRecording ? 'Menyimpan...' : 'Simpan Pembayaran'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detail & Riwayat Pembayaran */}
      {detailInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <div className="font-mono text-sm font-bold text-blue-600">
                  {detailInvoice.invoice_number}
                </div>
                <h2 className="text-lg font-bold text-slate-900">
                  {detailInvoice.customer?.business_name ||
                    detailInvoice.customer?.name}
                </h2>
                <p className="text-xs text-slate-500">
                  Ref Order: {detailInvoice.order?.order_number ?? '-'} • Jatuh
                  Tempo: {formatShortDateID(detailInvoice.due_date)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailInvoice(null)}
                className="rounded-lg p-1 text-slate-600 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {/* Progress Pelunasan */}
            {(() => {
              const pct =
                detailInvoice.total_amount > 0
                  ? Math.min(
                      100,
                      Math.round(
                        (detailInvoice.paid_amount /
                          detailInvoice.total_amount) *
                          100
                      )
                    )
                  : 100;
              const remaining = Math.max(
                0,
                detailInvoice.total_amount - detailInvoice.paid_amount
              );

              return (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex justify-between text-xs font-semibold text-slate-700">
                    <span>Progres Pelunasan ({pct}%)</span>
                    <span>
                      {formatRupiah(detailInvoice.paid_amount)} /{' '}
                      {formatRupiah(detailInvoice.total_amount)}
                    </span>
                  </div>
                  <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {remaining > 0 && (
                    <div className="mt-2 text-right text-xs font-semibold text-amber-600">
                      Sisa belum dibayar: {formatRupiah(remaining)}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Tabel Riwayat Pembayaran */}
            <div className="mt-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Riwayat Pembayaran Diterima
              </h3>

              {detailInvoice.payments.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-xs text-slate-600">
                  Belum ada pembayaran yang tercatat untuk tagihan ini.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50 font-semibold uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2.5">Tanggal</th>
                        <th className="px-3 py-2.5">Metode</th>
                        <th className="px-3 py-2.5">No. Referensi / Catatan</th>
                        <th className="px-3 py-2.5 text-right">Nominal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {detailInvoice.payments.map((pay) => (
                        <tr key={pay.id}>
                          <td className="px-3 py-2.5 font-medium text-slate-800">
                            {formatShortDateID(pay.payment_date)}
                          </td>
                          <td className="px-3 py-2.5 uppercase text-slate-600">
                            {METHOD_LABELS[
                              pay.payment_method as PaymentMethod
                            ] ?? pay.payment_method}
                          </td>
                          <td className="px-3 py-2.5 text-slate-600">
                            {pay.notes || '-'}
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold text-emerald-600">
                            {formatRupiah(pay.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setDetailInvoice(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Tutup
              </button>
              {detailInvoice.status !== 'paid' &&
                detailInvoice.status !== 'void' && (
                  <button
                    type="button"
                    onClick={() => {
                      const target = detailInvoice;
                      setDetailInvoice(null);
                      openPaymentModal(target);
                    }}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    Catat Pembayaran Baru
                  </button>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}