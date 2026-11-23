import { createClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { parseOrderMessage } from '@/lib/ai/order-parser';
import type { Database } from '@/types/database.types';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return NextResponse.json({ error: 'Invalid verify token' }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !supabaseUrl) {
    return NextResponse.json({ error: 'Webhook server keys belum dikonfigurasi' }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const metaMsg = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  const senderPhone = String(metaMsg?.from ?? body?.sender ?? body?.from ?? '').replace(/\D/g, '');
  const messageText = String(metaMsg?.text?.body ?? body?.message ?? body?.text ?? '').trim();

  if (!senderPhone || !messageText) {
    return NextResponse.json({ status: 'ignored' }, { status: 200 });
  }

  const supabase = createClient<Database>(supabaseUrl, serviceKey);
  const { data: customer } = await supabase
    .from('customers')
    .select('id, organization_id, name, business_name, phone, tier, payment_terms')
    .ilike('phone', `%${senderPhone.slice(-9)}`)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (!customer) {
    return NextResponse.json({ status: 'unknown_sender', phone: senderPhone }, { status: 200 });
  }

  const { data: products } = await supabase
    .from('products')
    .select('id, sku, name, unit, selling_price, wholesale_price, current_stock')
    .eq('organization_id', customer.organization_id)
    .eq('is_active', true);

  const parsed = await parseOrderMessage({
    rawText: messageText,
    senderPhone,
    customers: [customer],
    products: (products ?? []).map((p) => ({ ...p, selling_price: Number(p.selling_price), wholesale_price: Number(p.wholesale_price), current_stock: Number(p.current_stock) })),
  });

  if (parsed.items.length === 0) {
    return NextResponse.json({ status: 'no_items_matched' }, { status: 200 });
  }

  const subtotal = parsed.items.reduce((s, i) => s + i.qty * i.unit_price, 0);
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const orderNumber = `ORD-${ymd}-${Math.floor(1000 + Math.random() * 9000)}`;

  const { data: order } = await supabase.from('orders').insert({
    organization_id: customer.organization_id, customer_id: customer.id, order_number: orderNumber,
    status: 'draft', source: 'whatsapp', subtotal, discount: 0, total_amount: subtotal,
    notes: `[WA ${senderPhone}] ${parsed.notes || messageText.slice(0, 120)}`,
  }).select('id').single();

  if (order) {
    await supabase.from('order_items').insert(
      parsed.items.map((i) => ({ organization_id: customer.organization_id, order_id: order.id, product_id: i.product_id, qty: i.qty, unit_price: i.unit_price }))
    );
  }

  return NextResponse.json({ status: 'draft_created', order_number: orderNumber }, { status: 200 });
}
