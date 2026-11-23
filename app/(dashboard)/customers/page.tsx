import {
  CustomerManager,
  type CustomerItem,
} from '@/components/customers/customer-manager';
import { getActiveOrgContext } from '@/lib/supabase/get-active-org';

export default async function CustomersPage() {
  const { supabase, organizationId } = await getActiveOrgContext();

  const [customersRes, invoicesRes] = await Promise.all([
    supabase
      .from('customers')
      .select(
        'id, name, business_name, phone, email, address, tier, payment_terms, credit_limit, is_active'
      )
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false }),

    supabase
      .from('invoices')
      .select('customer_id, total_amount, paid_amount, status')
      .eq('organization_id', organizationId)
      .in('status', ['unpaid', 'partial', 'overdue']),
  ]);

  if (customersRes.error) {
    throw new Error(`Gagal memuat data pelanggan: ${customersRes.error.message}`);
  }

  const receivableByCustomer = new Map<string, number>();
  for (const inv of invoicesRes.data ?? []) {
    if (!inv.customer_id) continue;
    const remaining = Math.max(
      0,
      Number(inv.total_amount) - Number(inv.paid_amount)
    );
    receivableByCustomer.set(
      inv.customer_id,
      (receivableByCustomer.get(inv.customer_id) ?? 0) + remaining
    );
  }

  const enrichedCustomers: CustomerItem[] = (customersRes.data ?? []).map(
    (c) => {
      const activeReceivable = receivableByCustomer.get(c.id) ?? 0;
      const creditLimit = Number(c.credit_limit ?? 0);
      return {
        id: c.id,
        name: c.name,
        business_name: c.business_name,
        phone: c.phone,
        email: c.email,
        address: c.address,
        tier: c.tier,
        payment_terms: c.payment_terms,
        credit_limit: creditLimit,
        is_active: c.is_active,
        active_receivable: activeReceivable,
        outstanding_receivable: activeReceivable,
        remaining_credit: Math.max(0, creditLimit - activeReceivable),
      };
    }
  );

  return <CustomerManager customers={enrichedCustomers} />;
}
