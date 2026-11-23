'use server';

import { revalidatePath } from 'next/cache';
import { getActiveOrgContext } from '@/lib/supabase/get-active-org';
import type { Database } from '@/types/database.types';

type OrderStatus = Database['public']['Enums']['order_status'];
type OrderSource = Database['public']['Enums']['order_source'];
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
  return `${prefix}-${formatDateISO(0).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
}

export async function createOrderAction(_prev: OrderActionState, formData: FormData): Promise<OrderActionState> {
  const { supabase, user, organizationId } = await getActiveOrgContext();
  const customerId = String(formData.get('customer_id') ?? '').trim();
  const discount = Math.max(0, Number(formData.get('discount') || 0));
  const notes = String(formData.get('notes') ?? '').trim();
  const submitMode = String(formData.get('submit_mode') || 'confirm');
  const rawSource = String(formData.get('source') || 'manual');
  const source: OrderSource = rawSource === 'ai_parsed' || rawSource === 'whatsapp' ? rawSource : 'manual';
  if (!customerId) return { error: 'Pilih pelanggan terlebih dahulu.' };

  let items: Array<{ product_id: string; qty: number; unit_price: number }> = [];
  try { items = JSON.parse(String(formData.get('items_json') ?? '[]')); } catch { return { error: 'Format item tidak valid.' }; }
  const validItems = items.filter((i) => i.product_id && i.qty > 0 && i.unit_price >= 0);
  if (validItems.length === 0) return { error: 'Tambahkan minimal 1 produk.' };

  const { data: customer } = await supabase.from('customers').select('id, payment_terms').eq('id', customerId).eq('organization_id', organizationId).single();
  if (!customer) return { error: 'Pelanggan tidak ditemukan.' };

  if (submitMode === 'confirm') {
    for (const item of validItems) {
      const { data: prod } = await supabase.from('products').select('sku, name, unit, current_stock').eq('id', item.product_id).eq('organization_id', organizationId).single();
      if (!prod) return { error: 'Produk tidak ditemukan.' };
      if (Number(prod.current_stock) < item.qty) return { error: `Stok [${prod.sku}] ${prod.name} kurang (sisa ${prod.current_stock} ${prod.unit}). Simpan sebagai Draft dulu.` };
    }
  }

  const subtotal = validItems.reduce((sum, i) => sum + i.qty * i.unit_price, 0);
  const totalAmount = Math.max(0, subtotal - discount);
  const orderNumber = generateDocNumber('ORD');

  const { data: order, error: orderError } = await supabase.from('orders').insert({
    organization_id: organizationId, customer_id: customerId, order_number: orderNumber,
    order_date: new Date().toISOString(), status: 'draft', source, subtotal, discount, total_amount: totalAmount,
    notes: notes || null, created_by: user.id,
  }).select('id').single();
  if (orderError || !order) return { error: `Gagal membuat pesanan: ${orderError?.message ?? 'Unknown'}` };

  const { error: itemsError } = await supabase.from('order_items').insert(
    validItems.map((item) => ({ organization_id: organizationId, order_id: order.id, product_id: item.product_id, qty: item.qty, unit_price: item.unit_price }))
  );
  if (itemsError) {
    await supabase.from('orders').delete().eq('id', order.id);
    return { error: `Item pesanan gagal disimpan: ${itemsError.message}` };
  }

  if (submitMode === 'confirm') {
    const { error: confirmError } = await supabase.from('orders').update({ status: 'confirmed' }).eq('id', order.id).eq('organization_id', organizationId);
    if (confirmError) return { error: `Tersimpan sebagai Draft, gagal konfirmasi stok: ${confirmError.message}` };

    const term: PaymentTerm = customer.payment_terms ?? 'COD';
    await supabase.from('invoices').insert({
      organization_id: organizationId, order_id: order.id, customer_id: customerId,
      invoice_number: generateDocNumber('INV'), status: 'unpaid', due_date: formatDateISO(TERM_DAYS[term] ?? 0),
      total_amount: totalAmount, paid_amount: 0, notes: `Tagihan otomatis untuk ${orderNumber}`,
    });
  }

  revalidatePath('/orders'); revalidatePath('/invoices'); revalidatePath('/inventory'); revalidatePath('/products'); revalidatePath('/');
  return { success: submitMode === 'draft' ? `Draft Order ${orderNumber} berhasil disimpan.` : `Pesanan ${orderNumber} dikonfirmasi, stok terpotong & invoice terbit.` };
}

export async function updateOrderStatusAction(orderId: string, nextStatus: OrderStatus): Promise<OrderActionState> {
  const { supabase, organizationId } = await getActiveOrgContext();
  const { data: order } = await supabase
    .from('orders')
    .select('id, order_number, status, customer_id, total_amount, customers(payment_terms), order_items(qty, products(sku, name, unit, current_stock))')
    .eq('id', orderId)
    .eq('organization_id', organizationId)
    .single();

  if (!order) return { error: 'Pesanan tidak ditemukan.' };

  if (nextStatus === 'confirmed' && order.status === 'draft') {
    for (const item of order.order_items ?? []) {
      const prod = Array.isArray(item.products) ? item.products[0] : item.products;
      if (prod && Number(prod.current_stock) < item.qty) {
        return { error: `Stok [${prod.sku}] ${prod.name} tidak cukup (sisa ${prod.current_stock} ${prod.unit}).` };
      }
    }
  }

  const { error } = await supabase.from('orders').update({ status: nextStatus }).eq('id', orderId).eq('organization_id', organizationId);
  if (error) return { error: error.message };

  if (nextStatus === 'confirmed' && order.status === 'draft') {
    const cust = Array.isArray(order.customers) ? order.customers[0] : order.customers;
    const term: PaymentTerm = (cust?.payment_terms as PaymentTerm) ?? 'COD';
    const { data: existingInv } = await supabase.from('invoices').select('id').eq('order_id', order.id).maybeSingle();
    if (!existingInv) {
      await supabase.from('invoices').insert({
        organization_id: organizationId, order_id: order.id, customer_id: order.customer_id,
        invoice_number: generateDocNumber('INV'), status: 'unpaid', due_date: formatDateISO(TERM_DAYS[term] ?? 0),
        total_amount: Number(order.total_amount), paid_amount: 0, notes: `Tagihan otomatis untuk ${order.order_number}`,
      });
    }
  }

  revalidatePath('/orders'); revalidatePath('/invoices'); revalidatePath('/inventory'); revalidatePath('/products'); revalidatePath('/');
  return { success: nextStatus === 'confirmed' ? `Pesanan ${order.order_number} dikonfirmasi & stok terpotong.` : `Status diubah menjadi ${nextStatus.toUpperCase()}.` };
}

export async function generateInvoiceForOrderAction(orderId: string): Promise<OrderActionState> {
  const { supabase, organizationId } = await getActiveOrgContext();
  const { data: existing } = await supabase.from('invoices').select('invoice_number').eq('order_id', orderId).eq('organization_id', organizationId).maybeSingle();
  if (existing) return { error: `Invoice ${existing.invoice_number} sudah ada.` };
  const { data: order } = await supabase.from('orders').select('id, order_number, customer_id, total_amount, customers(payment_terms)').eq('id', orderId).eq('organization_id', organizationId).single();
  if (!order) return { error: 'Pesanan tidak ditemukan.' };
  const cust = Array.isArray(order.customers) ? order.customers[0] : order.customers;
  const dueDate = formatDateISO(TERM_DAYS[(cust?.payment_terms as PaymentTerm) ?? 'COD'] ?? 0);
  const invoiceNumber = generateDocNumber('INV');
  const { error } = await supabase.from('invoices').insert({
    organization_id: organizationId, order_id: order.id, customer_id: order.customer_id,
    invoice_number: invoiceNumber, status: 'unpaid', due_date: dueDate,
    total_amount: Number(order.total_amount), paid_amount: 0, notes: `Tagihan untuk ${order.order_number}`,
  });
  if (error) return { error: error.message };
  revalidatePath('/orders'); revalidatePath('/invoices'); revalidatePath('/');
  return { success: `Invoice ${invoiceNumber} diterbitkan.` };
}
