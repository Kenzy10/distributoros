'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type {
  CustomerAgingRow,
  ReportPeriodKey,
  TopProductRow,
} from '@/lib/queries/analytics';
import { formatRupiah } from '@/lib/utils';

type ReportsProps = {
  period: {
    key: ReportPeriodKey;
    label: string;
  };
  salesSummary: {
    grossSales: number;
    totalDiscount: number;
    netSales: number;
    totalOrders: number;
    avgOrderValue: number;
    trend: Array<{ key: string; label: string; total: number }>;
    tierBreakdown: Array<{
      tier: string;
      order_count: number;
      net_sales: number;
    }>;
  };
  topProducts: TopProductRow[];
  agingSummary: {
    current_amount: number;
    days_1_30: number;
    days_31_60: number;
    days_over_60: number;
    total_outstanding: number;
    open_invoices_count: number;
  };
  customerAgingRows: CustomerAgingRow[];
};

const PERIOD_OPTIONS: Array<{ key: ReportPeriodKey; label: string }> = [
  { key: 'this_month', label: 'Bulan Ini' },
  { key: '7d', label: '7 Hari' },
  { key: '30d', label: '30 Hari' },
  { key: '90d', label: '90 Hari' },
  { key: '365d', label: '1 Tahun' },
];

export function ReportsView({
  period,
  salesSummary,
  topProducts,
  agingSummary,
  customerAgingRows,
}: ReportsProps) {
  const router = useRouter();

  const maxTrendVal = Math.max(
    ...salesSummary.trend.map((t) => t.total),
    1
  );

  function handleExportCSV() {
    const lines: string[] = [
      `LAPORAN DISTRIBUSIOS - PERIODE: ${period.label.toUpperCase()}`,
      '',
      'RINGKASAN PENJUALAN',
      'Metrik,Nilai',
      `Penjualan Kotor,${salesSummary.grossSales}`,
      `Total Diskon,${salesSummary.totalDiscount}`,
      `Penjualan Bersih,${salesSummary.netSales}`,
      `Jumlah Pesanan,${salesSummary.totalOrders}`,
      `Rata-rata Nilai Pesanan,${salesSummary.avgOrderValue}`,
      '',
      'PRODUK TERLARIS',
      'SKU,Nama Produk,Satuan,Qty Terjual,Jumlah Order,Total Omzet,Kontribusi (%),Sisa Stok',
      ...topProducts.map(
        (p) =>
          `"${p.sku}","${p.name.replace(/"/g, '""')}","${p.unit}",${p.total_qty},${p.order_count},${p.total_revenue},${p.revenue_share_pct}%,${p.current_stock}`
      ),
      '',
      'AGING PIUTANG PELANGGAN',
      'Pelanggan,Jumlah Tagihan,Belum Jatuh Tempo,1-30 Hari,31-60 Hari,> 60 Hari,Total Piutang',
      ...customerAgingRows.map(
        (c) =>
          `"${c.customer_name.replace(/"/g, '""')}",${c.invoice_count},${c.current_amount},${c.days_1_30},${c.days_31_60},${c.days_over_60},${c.total_outstanding}`
      ),
    ];

    const blob = new Blob([lines.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `laporan-distribusios-${period.key}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Header & Filter Periode */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Laporan Penjualan & Aging Piutang
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Analisis omzet periode <span className="font-semibold">{period.label}</span>,
            performa SKU terlaris, dan umur piutang pelanggan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <div className="flex rounded-lg border border-slate-200 bg-white p-1">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => router.push(`/reports?period=${opt.key}`)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  period.key === opt.key
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleExportCSV}
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Export CSV
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            Cetak Laporan
          </button>
        </div>
      </div>

      {/* BAGIAN 1: LAPORAN PENJUALAN PERIODE */}
      <section className="space-y-4">
        <h2 className="text-base font-bold text-slate-900">
          1. Ringkasan Penjualan ({period.label})
        </h2>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <p className="text-xs font-semibold uppercase text-slate-600">
              Penjualan Bersih (Net)
            </p>
            <p className="mt-1 text-xl font-bold text-slate-900">
              {formatRupiah(salesSummary.netSales)}
            </p>
            <p className="mt-0.5 text-xs text-slate-600">
              Kotor: {formatRupiah(salesSummary.grossSales)}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <p className="text-xs font-semibold uppercase text-slate-600">
              Total Pesanan Valid
            </p>
            <p className="mt-1 text-xl font-bold text-blue-600">
              {salesSummary.totalOrders} order
            </p>
            <p className="mt-0.5 text-xs text-slate-600">
              Status Terkonfirmasi s/d Selesai
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <p className="text-xs font-semibold uppercase text-slate-600">
              Rata-Rata Nilai Order (AOV)
            </p>
            <p className="mt-1 text-xl font-bold text-emerald-600">
              {formatRupiah(salesSummary.avgOrderValue)}
            </p>
            <p className="mt-0.5 text-xs text-slate-600">
              Per transaksi pesanan B2B
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <p className="text-xs font-semibold uppercase text-slate-600">
              Total Potongan / Diskon
            </p>
            <p className="mt-1 text-xl font-bold text-amber-600">
              {formatRupiah(salesSummary.totalDiscount)}
            </p>
            <p className="mt-0.5 text-xs text-slate-600">
              Akumulasi diskon faktur periode ini
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Grafik Tren Penjualan */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs lg:col-span-2">
            <h3 className="text-sm font-bold text-slate-900">
              Grafik Pergerakan Omzet ({period.label})
            </h3>
            {salesSummary.trend.length === 0 ? (
              <div className="mt-4 rounded-lg border border-dashed border-slate-200 py-14 text-center text-xs text-slate-600">
                Belum ada transaksi penjualan terkonfirmasi pada periode ini.
              </div>
            ) : (
              <div className="mt-5 overflow-x-auto">
                <div className="flex h-44 min-w-[420px] items-end gap-2 border-b border-slate-100 pb-2">
                  {salesSummary.trend.map((pt) => {
                    const pct = Math.max(
                      8,
                      Math.round((pt.total / maxTrendVal) * 100)
                    );
                    return (
                      <div
                        key={pt.key}
                        className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5"
                      >
                        <div
                          className="w-full max-w-[36px] rounded-t-md bg-blue-600 transition group-hover:bg-blue-700"
                          style={{ height: `${pct}%` }}
                          title={`${pt.label}: ${formatRupiah(pt.total)}`}
                        />
                        <span className="truncate text-[10px] text-slate-500">
                          {pt.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Kontribusi per Tier Pelanggan */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-900">
              Penjualan per Tier Pelanggan
            </h3>
            {salesSummary.tierBreakdown.length === 0 ? (
              <div className="mt-4 rounded-lg border border-dashed border-slate-200 py-14 text-center text-xs text-slate-600">
                Belum ada data penjualan per tier.
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {salesSummary.tierBreakdown.map((t) => {
                  const sharePct =
                    salesSummary.netSales > 0
                      ? Math.round((t.net_sales / salesSummary.netSales) * 100)
                      : 0;
                  return (
                    <div key={t.tier} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold uppercase text-slate-800">
                          {t.tier} ({t.order_count} order)
                        </span>
                        <span className="font-semibold text-slate-900">
                          {formatRupiah(t.net_sales)} ({sharePct}%)
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-indigo-600"
                          style={{ width: `${sharePct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* BAGIAN 2: PRODUK TERLARIS */}
      <section className="space-y-3">
        <h2 className="text-base font-bold text-slate-900">
          2. Produk Terlaris ({period.label})
        </h2>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">SKU & Nama Produk</th>
                  <th className="px-4 py-3 text-right">Qty Terjual</th>
                  <th className="px-4 py-3 text-right">Frekuensi Order</th>
                  <th className="px-4 py-3 text-right">Total Omzet</th>
                  <th className="px-4 py-3 text-right">Kontribusi</th>
                  <th className="px-4 py-3 text-right">Sisa Stok</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topProducts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-xs text-slate-600"
                    >
                      Belum ada produk terjual pada periode ini.
                    </td>
                  </tr>
                ) : (
                  topProducts.map((prod, idx) => (
                    <tr key={prod.product_id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-bold text-slate-600">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">
                          {prod.name}
                        </div>
                        <div className="font-mono text-xs text-slate-600">
                          {prod.sku}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">
                        {prod.total_qty} {prod.unit}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">
                        {prod.order_count}x
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900">
                        {formatRupiah(prod.total_revenue)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                          {prod.revenue_share_pct}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`text-xs font-semibold ${
                            prod.current_stock <= 10
                              ? 'text-red-600'
                              : 'text-slate-600'
                          }`}
                        >
                          {prod.current_stock} {prod.unit}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* BAGIAN 3: AGING PIUTANG (ACCOUNTS RECEIVABLE AGING) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              3. Laporan Umur Piutang (Aging Piutang)
            </h2>
            <p className="text-xs text-slate-500">
              Posisi seluruh tagihan aktif belum lunas per hari ini ({agingSummary.open_invoices_count} tagihan terbuka)
            </p>
          </div>
          <Link
            href="/invoices"
            className="text-xs font-semibold text-blue-600 hover:underline print:hidden"
          >
            Buka Modul Penagihan →
          </Link>
        </div>

        {/* 4 Kartu Bucket Aging */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <p className="text-xs font-semibold uppercase text-emerald-600">
              Belum Jatuh Tempo (Current)
            </p>
            <p className="mt-1 text-lg font-bold text-slate-900">
              {formatRupiah(agingSummary.current_amount)}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <p className="text-xs font-semibold uppercase text-amber-600">
              Terlambat 1 – 30 Hari
            </p>
            <p className="mt-1 text-lg font-bold text-amber-600">
              {formatRupiah(agingSummary.days_1_30)}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <p className="text-xs font-semibold uppercase text-orange-600">
              Terlambat 31 – 60 Hari
            </p>
            <p className="mt-1 text-lg font-bold text-orange-600">
              {formatRupiah(agingSummary.days_31_60)}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs">
            <p className="text-xs font-semibold uppercase text-red-600">
              Terlambat &gt; 60 Hari
            </p>
            <p className="mt-1 text-lg font-bold text-red-600">
              {formatRupiah(agingSummary.days_over_60)}
            </p>
          </div>
        </div>

        {/* Tabel Aging Piutang per Pelanggan */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Pelanggan</th>
                  <th className="px-4 py-3 text-center">Tagihan</th>
                  <th className="px-4 py-3 text-right">Belum Jatuh Tempo</th>
                  <th className="px-4 py-3 text-right">1–30 Hari</th>
                  <th className="px-4 py-3 text-right">31–60 Hari</th>
                  <th className="px-4 py-3 text-right">&gt; 60 Hari</th>
                  <th className="px-4 py-3 text-right">Total Piutang</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customerAgingRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-xs text-slate-600"
                    >
                      Seluruh piutang pelanggan sudah lunas.
                    </td>
                  </tr>
                ) : (
                  customerAgingRows.map((row) => (
                    <tr key={row.customer_id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {row.customer_name}
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-slate-600">
                        {row.invoice_count} inv
                      </td>
                      <td className="px-4 py-3 text-right text-slate-700">
                        {row.current_amount > 0
                          ? formatRupiah(row.current_amount)
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-amber-600">
                        {row.days_1_30 > 0
                          ? formatRupiah(row.days_1_30)
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-orange-600">
                        {row.days_31_60 > 0
                          ? formatRupiah(row.days_31_60)
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-red-600">
                        {row.days_over_60 > 0
                          ? formatRupiah(row.days_over_60)
                          : '-'}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900">
                        {formatRupiah(row.total_outstanding)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {customerAgingRows.length > 0 && (
                <tfoot className="border-t-2 border-slate-200 bg-slate-50 text-xs font-bold text-slate-900">
                  <tr>
                    <td className="px-4 py-3">TOTAL PIUTANG</td>
                    <td className="px-4 py-3 text-center">
                      {agingSummary.open_invoices_count} inv
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatRupiah(agingSummary.current_amount)}
                    </td>
                    <td className="px-4 py-3 text-right text-amber-700">
                      {formatRupiah(agingSummary.days_1_30)}
                    </td>
                    <td className="px-4 py-3 text-right text-orange-700">
                      {formatRupiah(agingSummary.days_31_60)}
                    </td>
                    <td className="px-4 py-3 text-right text-red-700">
                      {formatRupiah(agingSummary.days_over_60)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      {formatRupiah(agingSummary.total_outstanding)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}