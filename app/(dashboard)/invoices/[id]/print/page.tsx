import { notFound } from 'next/navigation';
import { PrintToolbar } from '@/components/invoices/print-toolbar';
import { getActiveOrgContext } from '@/lib/supabase/get-active-org';
import { formatRupiah } from '@/lib/utils';

export default async function InvoicePrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const [{ id }, { mode: rawMode }, { supabase, organizationId }] =
    await Promise.all([params, searchParams, getActiveOrgContext()]);

  const mode = rawMode === 'surat-jalan' ? 'surat-jalan' : 'invoice';

  const [orgRes, invRes] = await Promise.all([
    supabase
      .from('organizations')
      .select('name, address, phone, tax_id')
      .eq('id', organizationId)
      .single(),
    supabase
      .from('invoices')
      .select(
        'id, invoice_number, status, due_date, total_amount, paid_amount, notes, created_at, order_id, customer_id'
      )
      .eq('id', id)
      .eq('organization_id', organizationId)
      .maybeSingle(),
  ]);

  if (!invRes.data) notFound();
  const inv = invRes.data;

  const [custRes, ordRes, itemsRes] = await Promise.all([
    supabase
      .from('customers')
      .select('name, business_name, phone, address, payment_terms')
      .eq('id', inv.customer_id)
      .maybeSingle(),
    inv.order_id ? supabase.from('orders')
      .select('order_number, order_date, subtotal, discount, notes')
      .eq('id', inv.order_id).maybeSingle() : Promise.resolve({ data: null }),
    inv.order_id ? supabase.from('order_items')
      .select('id, qty, unit_price, subtotal, products(sku, name, unit)')
      .eq('order_id', inv.order_id) : Promise.resolve({ data: [] }),
  ]);

  const org = orgRes.data;
  const cust = custRes.data;
  const ord = ordRes.data;
  const items = itemsRes.data ?? [];
  const remaining = Math.max(0, Number(inv.total_amount) - Number(inv.paid_amount));

  return (
    <div className="mx-auto max-w-4xl">
      <PrintToolbar invoiceId={inv.id} mode={mode} />

      <div className="rounded-xl border border-slate-200 bg-white p-8 text-slate-900 shadow-2xs print:border-none print:p-0 print:shadow-none">
        <div className="flex items-start justify-between border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-xl font-bold uppercase tracking-tight">
              {org?.name || 'Distributor'}
            </h1>
            {org?.address && <p className="mt-1 text-xs text-slate-600">{org.address}</p>}
            <p className="text-xs text-slate-600">
              {org?.phone ? `Telp: ${org.phone}` : ''}{' '}
              {org?.tax_id ? `• NPWP: ${org.tax_id}` : ''}
            </p>
          </div>
          <div className="text-right">
            <span className="inline-block rounded bg-slate-900 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
              {mode === 'invoice' ? 'INVOICE TAGIHAN' : 'SURAT JALAN'}
            </span>
            <p className="mt-2 font-mono text-sm font-bold">{inv.invoice_number}</p>
            <p className="font-mono text-xs text-slate-500">
              Ref Order: {ord?.order_number ?? '-'}
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-6 text-xs">
          <div>
            <p className="font-semibold uppercase text-slate-600">Kepada Yth:</p>
            <p className="mt-1 text-sm font-bold">
              {cust?.business_name || cust?.name || 'Pelanggan'}
            </p>
            {cust?.business_name && <p className="text-slate-600">PIC: {cust.name}</p>}
            {cust?.address && <p className="mt-0.5 text-slate-600">{cust.address}</p>}
            {cust?.phone && <p className="text-slate-600">Telp/WA: {cust.phone}</p>}
          </div>
          <div className="space-y-1 text-right">
            <p>
              <span className="text-slate-500">Tanggal Order:</span>{' '}
              <span className="font-semibold">{ord?.order_date ?? '-'}</span>
            </p>
            <p>
              <span className="text-slate-500">Termin:</span>{' '}
              <span className="font-semibold">
                {(cust?.payment_terms ?? 'COD').replace('_', ' ')}
              </span>
            </p>
            {mode === 'invoice' && (
              <p>
                <span className="text-slate-500">Jatuh Tempo:</span>{' '}
                <span className="font-bold text-red-600">{inv.due_date}</span>
              </p>
            )}
          </div>
        </div>

        <table className="mt-6 w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-y border-slate-300 bg-slate-50 font-semibold uppercase text-slate-600">
              <th className="px-3 py-2.5">No</th>
              <th className="px-3 py-2.5">SKU</th>
              <th className="px-3 py-2.5">Nama Barang</th>
              <th className="px-3 py-2.5 text-right">Qty</th>
              {mode === 'invoice' ? (
                <>
                  <th className="px-3 py-2.5 text-right">Harga Satuan</th>
                  <th className="px-3 py-2.5 text-right">Subtotal</th>
                </>
              ) : (
                <th className="px-3 py-2.5 text-center">Cek Fisik</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {items.map((item, idx) => {
              const prod = Array.isArray(item.products)
                ? item.products[0]
                : item.products;
              return (
                <tr key={item.id}>
                  <td className="px-3 py-2">{idx + 1}</td>
                  <td className="px-3 py-2 font-mono">{prod?.sku ?? '-'}</td>
                  <td className="px-3 py-2 font-medium">{prod?.name ?? 'Produk'}</td>
                  <td className="px-3 py-2 text-right font-semibold">
                    {item.qty} {prod?.unit ?? 'pcs'}
                  </td>
                  {mode === 'invoice' ? (
                    <>
                      <td className="px-3 py-2 text-right">
                        {formatRupiah(item.unit_price)}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {formatRupiah(
                          item.subtotal ?? Number(item.qty) * Number(item.unit_price)
                        )}
                      </td>
                    </>
                  ) : (
                    <td className="px-3 py-2 text-center text-slate-600">[   ] Sesuai</td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>

        {mode === 'invoice' && (
          <div className="mt-6 flex justify-end">
            <div className="w-64 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Subtotal</span>
                <span>{formatRupiah(ord?.subtotal ?? inv.total_amount)}</span>
              </div>
              {Number(ord?.discount ?? 0) > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Diskon</span>
                  <span>- {formatRupiah(ord?.discount ?? 0)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-1.5 text-sm font-bold">
                <span>Total Tagihan</span>
                <span>{formatRupiah(inv.total_amount)}</span>
              </div>
              <div className="flex justify-between text-emerald-700">
                <span>Sudah Dibayar</span>
                <span>{formatRupiah(inv.paid_amount)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5 font-bold">
                <span>Sisa Tagihan</span>
                <span>{formatRupiah(remaining)}</span>
              </div>
            </div>
          </div>
        )}

        <div className="mt-12 grid grid-cols-3 gap-6 pt-4 text-center text-xs">
          <div>
            <p className="font-semibold">Admin / Gudang</p>
            <div className="mt-14 border-t border-slate-300 pt-1 text-slate-500">
              ( ............................ )
            </div>
          </div>
          <div>
            <p className="font-semibold">Pengirim / Sopir</p>
            <div className="mt-14 border-t border-slate-300 pt-1 text-slate-500">
              ( ............................ )
            </div>
          </div>
          <div>
            <p className="font-semibold">Penerima / Stempel Toko</p>
            <div className="mt-14 border-t border-slate-300 pt-1 text-slate-500">
              ( ............................ )
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
