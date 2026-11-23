import {
  OrderManager,
  type OrderCustomerOption,
  type OrderListItem,
  type OrderProductOption,
} from '@/components/orders/order-manager';
import { getActiveOrgContext } from '@/lib/supabase/get-active-org';

export default async function OrdersPage() {
  const { supabase, organizationId } = await getActiveOrgContext();
  const [ordersRes, customersRes, productsRes] = await Promise.all([
    supabase
      .from('orders')
      .select('id, order_number, order_date, status, source, subtotal, discount, total_amount, notes, customers(id, name, business_name, tier), order_items(id), invoices(invoice_number)')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.from('customers').select('id, name, business_name, tier, payment_terms').eq('organization_id', organizationId).eq('is_active', true).order('name'),
    supabase.from('products').select('id, sku, name, unit, selling_price, wholesale_price, current_stock').eq('organization_id', organizationId).eq('is_active', true).order('name'),
  ]);

  if (ordersRes.error) throw new Error(`Gagal memuat pesanan: ${ordersRes.error.message}`);

  const formattedOrders: OrderListItem[] = (ordersRes.data ?? []).map((ord) => {
    const cust = Array.isArray(ord.customers) ? ord.customers[0] : ord.customers;
    const inv = Array.isArray(ord.invoices) ? ord.invoices[0] : ord.invoices;
    return {
      id: ord.id, order_number: ord.order_number, order_date: ord.order_date, status: ord.status, source: ord.source,
      subtotal: Number(ord.subtotal), discount: Number(ord.discount), total_amount: Number(ord.total_amount), notes: ord.notes,
      customer_name: cust?.business_name || cust?.name || 'Pelanggan', customer_tier: cust?.tier ?? 'retail',
      items_count: (ord.order_items ?? []).length, invoice_number: inv?.invoice_number ?? null,
    };
  });

  return (
    <OrderManager
      orders={formattedOrders}
      customers={(customersRes.data ?? []).map((c) => ({ id: c.id, name: c.name, business_name: c.business_name, tier: c.tier, payment_terms: c.payment_terms }))}
      products={(productsRes.data ?? []).map((p) => ({ id: p.id, sku: p.sku, name: p.name, unit: p.unit, selling_price: Number(p.selling_price), wholesale_price: Number(p.wholesale_price), current_stock: Number(p.current_stock) }))}
    />
  );
}
