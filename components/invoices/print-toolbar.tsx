'use client';

import Link from 'next/link';

export function PrintToolbar({
  invoiceId,
  mode,
}: {
  invoiceId: string;
  mode: 'invoice' | 'surat-jalan';
}) {
  return (
    <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <Link
          href="/invoices"
          className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          ← Kembali
        </Link>
        <Link
          href={`/invoices/${invoiceId}/print?mode=invoice`}
          className={`rounded-lg px-3 py-2 text-xs font-semibold ${
            mode === 'invoice'
              ? 'bg-slate-900 text-white'
              : 'bg-slate-100 text-slate-600'
          }`}
        >
          Mode Invoice
        </Link>
        <Link
          href={`/invoices/${invoiceId}/print?mode=surat-jalan`}
          className={`rounded-lg px-3 py-2 text-xs font-semibold ${
            mode === 'surat-jalan'
              ? 'bg-slate-900 text-white'
              : 'bg-slate-100 text-slate-600'
          }`}
        >
          Mode Surat Jalan
        </Link>
      </div>
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
      >
        Cetak / Simpan PDF
      </button>
    </div>
  );
}
