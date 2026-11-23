import {
  InvoiceManager,
  type InvoiceWithDetails,
} from '@/components/invoices/invoice-manager';
import { getActiveOrgContext } from '@/lib/supabase/get-active-org';

export default async function InvoicesPage() {
  const { supabase, organizationId } = await getActiveOrgContext();

  const { data: rawInvoices, error } = await supabase
    .from('invoices')
    .select(
      'id, invoice_number, status, due_date, total_amount, paid_amount, notes, created_at, orders(id, order_number), customers(id, name, business_name, phone, payment_terms), payments(id, amount, payment_method, payment_date, notes, created_at)'
    )
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(`Gagal memuat daftar tagihan: ${error.message}`);
  }

  const formattedInvoices: InvoiceWithDetails[] = (rawInvoices ?? []).map(
    (inv) => {
      const orderObj = Array.isArray(inv.orders)
        ? inv.orders[0]
        : inv.orders;
      const customerObj = Array.isArray(inv.customers)
        ? inv.customers[0]
        : inv.customers;

      const sortedPayments = [...(inv.payments ?? [])]
        .map((p) => ({
          id: p.id,
          amount: Number(p.amount),
          payment_method: p.payment_method,
          payment_date: p.payment_date,
          notes: p.notes,
          created_at: p.created_at,
        }))
        .sort((a, b) => b.payment_date.localeCompare(a.payment_date));

      return {
        id: inv.id,
        invoice_number: inv.invoice_number,
        status: inv.status,
        due_date: inv.due_date,
        total_amount: Number(inv.total_amount),
        paid_amount: Number(inv.paid_amount),
        notes: inv.notes,
        created_at: inv.created_at,
        order: orderObj ?? null,
        customer: customerObj ?? null,
        payments: sortedPayments,
      };
    }
  );

  return <InvoiceManager invoices={formattedInvoices} />;
}