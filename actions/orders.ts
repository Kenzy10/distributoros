'use server';

import { revalidatePath } from 'next/cache';
import { getActiveOrgContext } from '@/lib/supabase/get-active-org';
import type { Database } from '@/types/database.types';

type OrderStatus = Database['public']['Enums']['order_status'];
type PaymentTerm = Database['public']['Enums']['payment_term'];

export type OrderActionState = { error?: string; success?: string };

const TERM_DAYS: Record<PaymentTerm, number> = {
  COD: 0, NET_7: 7, NET_14: 14, NET_30: 30, NET_60: 60,
};

function formatDateISO(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function generateDocNumber(prefix: string): string {
  const ymd = formatDateISO(0).replace(/-/g, '');
  return `${prefix}-${ymd}-${Math.floor(1000 + Math.random() * 9000)}`;
}

export async function createOrderAction(
  _prevState: OrderActionState,
  formData: FormData
): Promise<OrderActionState> {
  const { supabase, user, organizationId } = await getActiveOrgContext();
  const customerId = String(formData.get('customer_id') ?? '').trim();
  const discount = Math.max(0, Number(formData.get('discount') || 0));
  const notes = String(formData.get('notes') ?? '').trim();

  if (!customerId) return { error: 'Pilih pelanggan terlebih dahulu.' };

  let items: Array<{ product_id: string; qty: number; unit_price: number }> = [];
  try {
    items = JSON.parse(String(formData.get('items_json') ?? '[]'));
  } catch {
    return { error: 'Format item pesanan tidak valid.' };
  }

  const validItems = items.filter((i) => i.product_id && i.qty > 0 && i.unit_price >= 0);
  if (validItems.length === 0) return { error: 'Tambahkan minimal 1 produk ke pesanan.' };

  const subtotal = validItems.reduce((sum, i) => sum + i.qty * i.unit_price, 0);
  const totalAmount = Math.max(0, subtotal - discount);
  const orderNumber = generateDocNumber('ORD');

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      organization_id: organizationId,
      customer_id: customerId,
      order_number: orderNumber,
      order_date: formatDateISO(0),
      status: 'confirmed',
      subtotal,
      discount,
      total_amount: totalAmount,
      notes: notes || null,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (orderError || !order) {
    return { error: `Gagal membuat pesanan: ${orderError?.message ?? 'Unknown error'}` };
  }

  const { error: itemsError } = await supabase.from('order_items').insert(
    validItems.map((item) => ({
      organization_id: organizationId,
      order_id: order.id,
      product_id: item.product_id,
      qty: item.qty,
      unit_price: item.unit_price,
      subtotal: item.qty * item.unit_price,
    }))
  );
  if (itemsError) return { error: `Item pesanan gagal disimpan: ${itemsError.message}` };

  for (const item of validItems) {
    const { data: prod } = await supabase
      .from('products')
      .select('current_stock')
      .eq('id', item.product_id)
      .eq('organization_id', organizationId)
      .single();

    if (prod) {
      await supabase
        .from('products')
        .update({ current_stock: Math.max(0, Number(prod.current_stock) - item.qty) })
        .eq('id', item.product_id)
        .eq('organization_id', organizationId);

      await supabase.from('inventory_movements').insert({
        organization_id: organizationId,
        product_id: item.product_id,
        type: 'out',
        qty: item.qty,
        reference_type: 'order',
        reference_id: order.id,
        notes: `Penjualan ${orderNumber}`,
        created_by: user.id,
      });
    }
  }

  revalidatePath('/orders');
  revalidatePath('/inventory');
  revalidatePath('/products');
  revalidatePath('/');
  return { success: `Pesanan ${orderNumber} berhasil dibuat dan stok diperbarui.` };
}

export async function updateOrderStatusAction(
  orderId: string,
  nextStatus: OrderStatus
): Promise<OrderActionState> {
  const { supabase, organizationId } = await getActiveOrgContext();
  const { error } = await supabase
    .from('orders')
    .update({ status: nextStatus })
    .eq('id', orderId)
    .eq('organization_id', organizationId);

  if (error) return { error: `Gagal mengubah status: ${error.message}` };
  revalidatePath('/orders');
  revalidatePath('/');
  return { success: `Status pesanan diubah menjadi ${nextStatus.toUpperCase()}.` };
}

export async function generateInvoiceForOrderAction(
  orderId: string
): Promise<OrderActionState> {
  const { supabase, organizationId } = await getActiveOrgContext();
  const { data: existing } = await supabase
    .from('invoices')
    .select('invoice_number')
    .eq('order_id', orderId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  if (existing) return { error: `Invoice ${existing.invoice_number} sudah diterbitkan.` };

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('id, order_number, customer_id, total_amount, customers(payment_terms)')
    .eq('id', orderId)
    .eq('organization_id', organizationId)
    .single();

  if (orderError || !order) return { error: 'Data pesanan tidak ditemukan.' };

  const cust = Array.isArray(order.customers) ? order.customers[0] : order.customers;
  const term: PaymentTerm = cust?.payment_terms ?? 'COD';
  const dueDate = formatDateISO(TERM_DAYS[term] ?? 0);
  const invoiceNumber = generateDocNumber('INV');

  const { error: invError } = await supabase.from('invoices').insert({
    organization_id: organizationId,
    order_id: order.id,
    customer_id: order.customer_id,
    invoice_number: invoiceNumber,
    status: 'unpaid',
    due_date: dueDate,
    total_amount: Number(order.total_amount),
    paid_amount: 0,
    notes: `Tagihan untuk pesanan ${order.order_number}`,
  });

  if (invError) return { error: `Gagal menerbitkan invoice: ${invError.message}` };
  revalidatePath('/orders');
  revalidatePath('/invoices');
  revalidatePath('/');
  return { success: `Invoice ${invoiceNumber} diterbitkan (Jatuh tempo: ${dueDate}).` };
}
