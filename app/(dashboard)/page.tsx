import Link from 'next/link';
import { getDashboardMetrics } from '@/lib/queries/analytics';
import { formatRupiah } from '@/lib/utils';

const ORDER_STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'bg-slate-100 text-slate-700' },
  confirmed: { label: 'Terkonfirmasi', cls: 'bg-blue-50 text-blue-700' },
  packed: { label: 'Dikemas', cls: 'bg-indigo-50 text-indigo-700' },
  shipped: { label: 'Dikirim', cls: 'bg-amber-50 text-amber-700' },
  completed: { label: 'Selesai', cls: 'bg-emerald-50 text-emerald-700' },
  cancelled: { label: 'Dibatalkan', cls: 'bg-red-50 text-red-700' },
};

export default async function DashboardPage() {
  const {
    kpis,
    dailySales7d,
    recentOrders,
    priorityInvoices,
    lowStockProducts,
  } = await getDashboardMetrics();

  const maxDailySale = Math.max(...dailySales7d.map((d) => d.total), 1);

  return (
    <div className="space-y-6">
      {/* Header & Quick Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Ringkasan Operasional Distribusi
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Pantau performa penjualan, perputaran stok gudang, dan penagihan
            piutang pelanggan hari ini.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/orders"
            className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-blue-700"
          >
            + Buat Pesanan Baru
          </Link>
          <Link
            href="/invoices"
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Catat Pembayaran
          </Link>
          <Link
            href="/reports"
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Lihat Laporan
          </Link>
        </div>
      </div>

      {/* 4 Kartu KPI Utama */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              Omzet Bulan Ini
            </p>
            {kpis.revenueGrowthPct !== null && (
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  kpis.revenueGrowthPct >= 0
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-red-50 text-red-700'
                }`}
              >
                {kpis.revenueGrowthPct >= 0 ? '+' : ''}
                {kpis.revenueGrowthPct}% vs bln lalu
              </span>
            )}
          </div>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {formatRupiah(kpis.revenueThisMonth)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Dari {kpis.ordersCountThisMonth} pesanan terkonfirmasi bulan ini
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              Piutang Belum Lunas
            </p>
            {kpis.overdueCount > 0 && (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700">
                {kpis.overdueCount} Overdue
              </span>
            )}
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-600">
            {formatRupiah(kpis.totalReceivable)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Jatuh tempo:{' '}
            <span className="font-semibold text-red-600">
              {formatRupiah(kpis.overdueReceivable)}
            </span>
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">
            Pesanan Perlu Diproses
          </p>
          <p className="mt-2 text-2xl font-bold text-blue-600">
            {kpis.pendingOrdersCount}{' '}
            <span className="text-sm font-medium text-slate-600">order</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Status Draft, Terkonfirmasi & Dikemas
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">
            Stok Menipis & Mitra
          </p>
          <p className="mt-2 text-2xl font-bold text-slate-900">
            {kpis.lowStockCount}{' '}
            <span className="text-sm font-medium text-amber-600">
              SKU menipis
            </span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {kpis.activeProductsCount} SKU aktif • {kpis.activeCustomersCount}{' '}
            pelanggan
          </p>
        </div>
      </div>

      {/* Grafik Tren Penjualan 7 Hari & Peringatan Stok */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Tren Penjualan 7 Hari Terakhir
              </h2>
              <p className="text-xs text-slate-500">
                Total nilai pesanan terkonfirmasi per hari
              </p>
            </div>
            <Link
              href="/reports"
              className="text-xs font-semibold text-blue-600 hover:underline"
            >
              Analisis Lengkap →
            </Link>
          </div>

          <div className="mt-6 grid h-44 grid-cols-7 items-end gap-3 border-b border-slate-100 pb-3">
            {dailySales7d.map((day) => {
              const heightPct =
                day.total > 0
                  ? Math.max(10, Math.round((day.total / maxDailySale) * 100))
                  : 4;
              return (
                <div
                  key={day.date}
                  className="group flex h-full flex-col items-center justify-end gap-2"
                >
                  <span className="text-[10px] font-semibold text-slate-500 opacity-0 transition group-hover:opacity-100">
                    {day.total > 0 ? formatRupiah(day.total) : 'Rp 0'}
                  </span>
                  <div
                    className={`w-full max-w-[44px] rounded-t-lg transition-all ${
                      day.total > 0
                        ? 'bg-blue-600 group-hover:bg-blue-700'
                        : 'bg-slate-100'
                    }`}
                    style={{ height: `${heightPct}%` }}
                    title={`${day.label}: ${formatRupiah(day.total)}`}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-3 text-center text-[11px] font-medium text-slate-500">
            {dailySales7d.map((day) => (
              <div key={day.date}>{day.label}</div>
            ))}
          </div>
        </div>

        {/* Peringatan Stok Gudang */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">
              Peringatan Stok Gudang
            </h2>
            <Link
              href="/inventory"
              className="text-xs font-semibold text-blue-600 hover:underline"
            >
              Restock →
            </Link>
          </div>

          {lowStockProducts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 py-10 text-center text-xs text-slate-600">
              Seluruh stok produk dalam kondisi aman (di atas 10 unit).
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {lowStockProducts.map((prod) => (
                <div
                  key={prod.id}
                  className="flex items-center justify-between py-2.5 text-xs"
                >
                  <div className="min-w-0 pr-2">
                    <div className="truncate font-semibold text-slate-900">
                      {prod.name}
                    </div>
                    <div className="font-mono text-[11px] text-slate-600">
                      {prod.sku}
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 font-bold ${
                      prod.current_stock === 0
                        ? 'bg-red-100 text-red-700'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {prod.current_stock} {prod.unit}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pesanan Terbaru & Tagihan Prioritas Penagihan */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Pesanan Terbaru */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">
              Pesanan Terbaru
            </h2>
            <Link
              href="/orders"
              className="text-xs font-semibold text-blue-600 hover:underline"
            >
              Semua Pesanan →
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 py-10 text-center text-xs text-slate-600">
              Belum ada transaksi pesanan.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentOrders.map((ord) => {
                const badge = ORDER_STATUS_BADGE[ord.status] ?? {
                  label: ord.status,
                  cls: 'bg-slate-100 text-slate-600',
                };
                return (
                  <div
                    key={ord.id}
                    className="flex items-center justify-between py-3 text-xs"
                  >
                    <div>
                      <div className="font-mono font-bold text-blue-600">
                        {ord.order_number}
                      </div>
                      <div className="font-medium text-slate-800">
                        {ord.customer_name}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-slate-900">
                        {formatRupiah(ord.total_amount)}
                      </div>
                      <span
                        className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.cls}`}
                      >
                        {badge.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Tagihan Prioritas Penagihan */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">
              Tagihan Prioritas Penagihan
            </h2>
            <Link
              href="/invoices"
              className="text-xs font-semibold text-blue-600 hover:underline"
            >
              Kelola Tagihan →
            </Link>
          </div>

          {priorityInvoices.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 py-10 text-center text-xs text-slate-600">
              Tidak ada tagihan aktif yang belum lunas.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {priorityInvoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between py-3 text-xs"
                >
                  <div>
                    <div className="font-mono font-bold text-slate-800">
                      {inv.invoice_number}
                    </div>
                    <div className="text-slate-600">{inv.customer_name}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-amber-600">
                      {formatRupiah(inv.remaining_amount)}
                    </div>
                    <div
                      className={`text-[11px] font-medium ${
                        inv.days_overdue > 0
                          ? 'text-red-600'
                          : inv.days_overdue === 0
                            ? 'text-amber-600'
                            : 'text-slate-600'
                      }`}
                    >
                      {inv.days_overdue > 0
                        ? `Terlambat ${inv.days_overdue} hari`
                        : inv.days_overdue === 0
                          ? 'Jatuh tempo hari ini'
                          : `Jatuh tempo ${inv.due_date}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}