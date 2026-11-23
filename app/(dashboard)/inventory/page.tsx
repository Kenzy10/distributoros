import { StockMovementForm } from '@/components/inventory/stock-movement-form';
import { getActiveOrgContext } from '@/lib/supabase/get-active-org';
import { formatDateTimeID } from '@/lib/utils';

const REFERENCE_LABELS: Record<string, string> = {
  purchase: 'Pembelian / Restock',
  initial_stock: 'Stok Awal',
  order: 'Pesanan Pelanggan',
  order_cancelled: 'Pembatalan Pesanan',
  stock_opname: 'Stok Opname',
  return_in: 'Retur Masuk',
};

export default async function InventoryPage() {
  const { supabase, organizationId } = await getActiveOrgContext();

  const [{ data: products }, { data: movements, error: movementsError }] =
    await Promise.all([
      supabase
        .from('products')
        .select('id, sku, name, unit, current_stock')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('name', { ascending: true }),
      supabase
        .from('inventory_movements')
        .select('*, products(sku, name, unit)')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

  if (movementsError) {
    throw new Error(`Gagal memuat riwayat mutasi stok: ${movementsError.message}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Inventory & Kartu Stok
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Catat penerimaan barang dari supplier, penyesuaian opname, dan pantau
          seluruh riwayat keluar-masuk gudang.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Form Mutasi Stok (Kiri - 4 Kolom) */}
        <div className="lg:col-span-4">
          <StockMovementForm products={products ?? []} />
        </div>

        {/* Ledger Riwayat Mutasi (Kanan - 8 Kolom) */}
        <div className="lg:col-span-8">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-base font-bold text-slate-900">
                Riwayat Mutasi Stok Terbaru
              </h2>
              <p className="text-xs text-slate-600">
                Menampilkan 50 transaksi keluar-masuk barang terakhir
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Waktu</th>
                    <th className="px-4 py-3">Produk</th>
                    <th className="px-4 py-3">Jenis</th>
                    <th className="px-4 py-3 text-right">Qty</th>
                    <th className="px-4 py-3">Referensi & Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!movements || movements.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-10 text-center text-slate-600"
                      >
                        Belum ada riwayat pergerakan stok.
                      </td>
                    </tr>
                  ) : (
                    movements.map((item) => {
                      const prod = Array.isArray(item.products)
                        ? item.products[0]
                        : item.products;

                      const isPositive =
                        item.type === 'in' ||
                        (item.type === 'adjustment' && item.qty > 0);

                      const badgeConfig =
                        item.type === 'in'
                          ? {
                              label: 'MASUK',
                              style: 'bg-emerald-50 text-emerald-700',
                            }
                          : item.type === 'out'
                            ? {
                                label: 'KELUAR',
                                style: 'bg-blue-50 text-blue-700',
                              }
                            : {
                                label: 'OPNAME',
                                style: 'bg-amber-50 text-amber-700',
                              };

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80">
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                            {formatDateTimeID(item.created_at)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-mono text-xs font-semibold text-blue-600">
                              {prod?.sku ?? '-'}
                            </div>
                            <div className="font-medium text-slate-900">
                              {prod?.name ?? 'Produk Dihapus'}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-block rounded px-2 py-0.5 text-[11px] font-bold ${badgeConfig.style}`}
                            >
                              {badgeConfig.label}
                            </span>
                          </td>
                          <td
                            className={`whitespace-nowrap px-4 py-3 text-right font-mono font-bold ${
                              isPositive ? 'text-emerald-600' : 'text-red-600'
                            }`}
                          >
                            {item.type === 'out'
                              ? `-${item.qty}`
                              : item.qty > 0
                                ? `+${item.qty}`
                                : item.qty}{' '}
                            <span className="font-sans text-xs font-normal text-slate-600">
                              {prod?.unit ?? ''}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600">
                            <div className="font-medium text-slate-800">
                              {REFERENCE_LABELS[item.reference_type ?? ''] ??
                                item.reference_type ??
                                'Mutasi Manual'}
                            </div>
                            {item.notes && (
                              <div className="text-slate-600">{item.notes}</div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}