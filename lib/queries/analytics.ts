import { getActiveOrgContext } from '@/lib/supabase/get-active-org';

export type ReportPeriodKey = 'this_month' | '7d' | '30d' | '90d' | '365d';

function getTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDaysOverdue(dueDateStr: string): number {
  const today = new Date(`${getTodayISO()}T00:00:00`);
  const due = new Date(`${dueDateStr}T00:00:00`);
  return Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
}

function getPeriodRange(period: ReportPeriodKey): {
  key: ReportPeriodKey;
  label: string;
  startISO: string;
} {
  const now = new Date();

  if (period === '7d') {
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return {
      key: '7d',
      label: '7 Hari Terakhir',
      startISO: start.toISOString(),
    };
  }

  if (period === '30d') {
    const start = new Date(now);
    start.setDate(now.getDate() - 29);
    start.setHours(0, 0, 0, 0);
    return {
      key: '30d',
      label: '30 Hari Terakhir',
      startISO: start.toISOString(),
    };
  }

  if (period === '90d') {
    const start = new Date(now);
    start.setDate(now.getDate() - 89);
    start.setHours(0, 0, 0, 0);
    return {
      key: '90d',
      label: '90 Hari Terakhir (Kuartal)',
      startISO: start.toISOString(),
    };
  }

  if (period === '365d') {
    const start = new Date(now);
    start.setDate(now.getDate() - 364);
    start.setHours(0, 0, 0, 0);
    return {
      key: '365d',
      label: '1 Tahun Terakhir',
      startISO: start.toISOString(),
    };
  }

  // Default: this_month
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  return {
    key: 'this_month',
    label: 'Bulan Ini',
    startISO: startOfMonth.toISOString(),
  };
}

export async function getDashboardMetrics() {
  const { supabase, organizationId } = await getActiveOrgContext();

  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [ordersRes, invoicesRes, productsRes, customersRes] =
    await Promise.all([
      supabase
        .from('orders')
        .select(
          'id, order_number, status, total_amount, created_at, customers(id, name, business_name)'
        )
        .eq('organization_id', organizationId)
        .gte('created_at', startOfLastMonth.toISOString())
        .order('created_at', { ascending: false }),

      supabase
        .from('invoices')
        .select(
          'id, invoice_number, status, due_date, total_amount, paid_amount, created_at, customers(id, name, business_name)'
        )
        .eq('organization_id', organizationId)
        .neq('status', 'void')
        .order('due_date', { ascending: true }),

      supabase
        .from('products')
        .select('id, sku, name, unit, current_stock')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('current_stock', { ascending: true }),

      supabase
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('is_active', true),
    ]);

  const allOrders = ordersRes.data ?? [];
  const allInvoices = invoicesRes.data ?? [];
  const activeProducts = productsRes.data ?? [];
  const activeCustomersCount = customersRes.count ?? 0;

  // 1. Omzet Bulan Ini vs Bulan Lalu (hanya order valid: bukan draft & bukan cancelled)
  const validSalesStatuses = new Set([
    'confirmed',
    'packed',
    'shipped',
    'completed',
  ]);

  let revenueThisMonth = 0;
  let revenueLastMonth = 0;
  let ordersCountThisMonth = 0;

  for (const order of allOrders) {
    if (!validSalesStatuses.has(order.status)) continue;
    const createdAt = new Date(order.created_at);
    const amount = Number(order.total_amount);

    if (createdAt >= startOfThisMonth) {
      revenueThisMonth += amount;
      ordersCountThisMonth += 1;
    } else if (createdAt >= startOfLastMonth) {
      revenueLastMonth += amount;
    }
  }

  const revenueGrowthPct =
    revenueLastMonth > 0
      ? Math.round(
          ((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100
        )
      : null;

  // 2. Pesanan Perlu Diproses (draft, confirmed, packed)
  const pendingOrdersCount = allOrders.filter((o) =>
    ['draft', 'confirmed', 'packed'].includes(o.status)
  ).length;

  // 3. Piutang Aktif & Jatuh Tempo
  let totalReceivable = 0;
  let overdueReceivable = 0;
  let overdueCount = 0;
  let collectedThisMonth = 0;

  const priorityInvoices: Array<{
    id: string;
    invoice_number: string;
    customer_name: string;
    due_date: string;
    remaining_amount: number;
    days_overdue: number;
  }> = [];

  for (const inv of allInvoices) {
    const total = Number(inv.total_amount);
    const paid = Number(inv.paid_amount);
    const remaining = Math.max(0, total - paid);

    if (new Date(inv.created_at) >= startOfThisMonth) {
      collectedThisMonth += paid;
    }

    if (
      ['unpaid', 'partial', 'overdue'].includes(inv.status) &&
      remaining > 0
    ) {
      totalReceivable += remaining;
      const daysOverdue = getDaysOverdue(inv.due_date);
      if (daysOverdue > 0 || inv.status === 'overdue') {
        overdueReceivable += remaining;
        overdueCount += 1;
      }

      const cust = Array.isArray(inv.customers)
        ? inv.customers[0]
        : inv.customers;

      priorityInvoices.push({
        id: inv.id,
        invoice_number: inv.invoice_number,
        customer_name: cust?.business_name || cust?.name || 'Pelanggan',
        due_date: inv.due_date,
        remaining_amount: remaining,
        days_overdue: daysOverdue,
      });
    }
  }

  // 4. Tren Penjualan 7 Hari Terakhir
  const dailySalesMap = new Map<string, { label: string; total: number }>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const label = new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
    }).format(d);
    dailySalesMap.set(iso, { label, total: 0 });
  }

  for (const order of allOrders) {
    if (!validSalesStatuses.has(order.status)) continue;
    const iso = order.created_at.slice(0, 10);
    const bucket = dailySalesMap.get(iso);
    if (bucket) {
      bucket.total += Number(order.total_amount);
    }
  }

  // 5. Produk Stok Menipis (<= 10 unit)
  const lowStockProducts = activeProducts.filter((p) => p.current_stock <= 10);

  // 6. 6 Pesanan Terbaru
  const recentOrders = allOrders.slice(0, 6).map((o) => {
    const cust = Array.isArray(o.customers) ? o.customers[0] : o.customers;
    return {
      id: o.id,
      order_number: o.order_number,
      status: o.status,
      total_amount: Number(o.total_amount),
      created_at: o.created_at,
      customer_name: cust?.business_name || cust?.name || 'Pelanggan',
    };
  });

  return {
    kpis: {
      revenueThisMonth,
      revenueGrowthPct,
      ordersCountThisMonth,
      pendingOrdersCount,
      totalReceivable,
      overdueReceivable,
      overdueCount,
      collectedThisMonth,
      activeProductsCount: activeProducts.length,
      lowStockCount: lowStockProducts.length,
      activeCustomersCount,
    },
    dailySales7d: Array.from(dailySalesMap.entries()).map(([date, val]) => ({
      date,
      label: val.label,
      total: val.total,
    })),
    recentOrders,
    priorityInvoices: priorityInvoices.slice(0, 5),
    lowStockProducts: lowStockProducts.slice(0, 5),
  };
}

export type TopProductRow = {
  product_id: string;
  sku: string;
  name: string;
  unit: string;
  total_qty: number;
  total_revenue: number;
  order_count: number;
  current_stock: number;
  revenue_share_pct: number;
};

export type CustomerAgingRow = {
  customer_id: string;
  customer_name: string;
  phone: string | null;
  current_amount: number; // Belum jatuh tempo (<= 0 hari)
  days_1_30: number; // Terlambat 1-30 hari
  days_31_60: number; // Terlambat 31-60 hari
  days_over_60: number; // Terlambat > 60 hari
  total_outstanding: number;
  invoice_count: number;
};

export async function getReportsData(periodParam?: string) {
  const { supabase, organizationId } = await getActiveOrgContext();

  const validPeriods: ReportPeriodKey[] = [
    'this_month',
    '7d',
    '30d',
    '90d',
    '365d',
  ];
  const selectedKey: ReportPeriodKey = validPeriods.includes(
    periodParam as ReportPeriodKey
  )
    ? (periodParam as ReportPeriodKey)
    : 'this_month';

  const period = getPeriodRange(selectedKey);

  const [ordersRes, openInvoicesRes] = await Promise.all([
    supabase
      .from('orders')
      .select(
        'id, order_number, status, subtotal, total_amount, created_at, customers(id, name, business_name, tier)'
      )
      .eq('organization_id', organizationId)
      .in('status', ['confirmed', 'packed', 'shipped', 'completed'])
      .gte('created_at', period.startISO)
      .order('created_at', { ascending: true }),

    supabase
      .from('invoices')
      .select(
        'id, invoice_number, status, due_date, total_amount, paid_amount, customers(id, name, business_name, phone)'
      )
      .eq('organization_id', organizationId)
      .in('status', ['unpaid', 'partial', 'overdue'])
      .order('due_date', { ascending: true }),
  ]);

  const validOrders = ordersRes.data ?? [];
  const openInvoices = openInvoicesRes.data ?? [];

  // 1. Ringkasan Penjualan Periode
  let grossSales = 0;
  let netSales = 0;
  const tierBreakdownMap = new Map<
    string,
    { tier: string; order_count: number; net_sales: number }
  >();
  const trendMap = new Map<string, { label: string; total: number }>();

  const groupByMonth = selectedKey === '365d';

  for (const order of validOrders) {
    const sub = Number(order.subtotal);
    const tot = Number(order.total_amount);
    grossSales += sub;
    netSales += tot;

    const cust = Array.isArray(order.customers)
      ? order.customers[0]
      : order.customers;
    const tier = cust?.tier ?? 'retail';
    const existingTier = tierBreakdownMap.get(tier) ?? {
      tier,
      order_count: 0,
      net_sales: 0,
    };
    existingTier.order_count += 1;
    existingTier.net_sales += tot;
    tierBreakdownMap.set(tier, existingTier);

    const dateObj = new Date(order.created_at);
    const bucketKey = groupByMonth
      ? order.created_at.slice(0, 7)
      : order.created_at.slice(0, 10);
    const bucketLabel = new Intl.DateTimeFormat(
      'id-ID',
      groupByMonth
        ? { month: 'short', year: '2-digit' }
        : { day: '2-digit', month: 'short' }
    ).format(dateObj);

    const existingTrend = trendMap.get(bucketKey) ?? {
      label: bucketLabel,
      total: 0,
    };
    existingTrend.total += tot;
    trendMap.set(bucketKey, existingTrend);
  }

  const totalDiscount = Math.max(0, grossSales - netSales);
  const totalOrders = validOrders.length;
  const avgOrderValue = totalOrders > 0 ? Math.round(netSales / totalOrders) : 0;

  // 2. Produk Terlaris dalam Periode Terpilih
  let topProducts: TopProductRow[] = [];
  if (validOrders.length > 0) {
    const orderIds = validOrders.map((o) => o.id);
    const { data: itemsData } = await supabase
      .from('order_items')
      .select(
        'order_id, product_id, qty, subtotal, products(id, sku, name, unit, current_stock)'
      )
      .eq('organization_id', organizationId)
      .in('order_id', orderIds);

    const productAgg = new Map<
      string,
      {
        product_id: string;
        sku: string;
        name: string;
        unit: string;
        total_qty: number;
        total_revenue: number;
        orderIds: Set<string>;
        current_stock: number;
      }
    >();

    for (const item of itemsData ?? []) {
      const prod = Array.isArray(item.products)
        ? item.products[0]
        : item.products;
      if (!prod) continue;

      const entry = productAgg.get(item.product_id) ?? {
        product_id: item.product_id,
        sku: prod.sku,
        name: prod.name,
        unit: prod.unit,
        total_qty: 0,
        total_revenue: 0,
        orderIds: new Set<string>(),
        current_stock: prod.current_stock,
      };

      entry.total_qty += Number(item.qty);
      entry.total_revenue += Number(item.subtotal);
      entry.orderIds.add(item.order_id);
      productAgg.set(item.product_id, entry);
    }

    topProducts = Array.from(productAgg.values())
      .map((p) => ({
        product_id: p.product_id,
        sku: p.sku,
        name: p.name,
        unit: p.unit,
        total_qty: p.total_qty,
        total_revenue: p.total_revenue,
        order_count: p.orderIds.size,
        current_stock: p.current_stock,
        revenue_share_pct:
          netSales > 0 ? Math.round((p.total_revenue / netSales) * 100) : 0,
      }))
      .sort((a, b) => b.total_revenue - a.total_revenue);
  }

  // 3. Laporan Aging Piutang (Accounts Receivable Aging)
  const agingSummary = {
    current_amount: 0,
    days_1_30: 0,
    days_31_60: 0,
    days_over_60: 0,
    total_outstanding: 0,
    open_invoices_count: 0,
  };

  const customerAgingMap = new Map<string, CustomerAgingRow>();

  for (const inv of openInvoices) {
    const remaining = Math.max(
      0,
      Number(inv.total_amount) - Number(inv.paid_amount)
    );
    if (remaining <= 0) continue;

    const daysOverdue = getDaysOverdue(inv.due_date);
    const cust = Array.isArray(inv.customers)
      ? inv.customers[0]
      : inv.customers;
    const customerId = cust?.id ?? 'unknown';
    const customerName =
      cust?.business_name || cust?.name || 'Pelanggan Umum';

    const row = customerAgingMap.get(customerId) ?? {
      customer_id: customerId,
      customer_name: customerName,
      phone: cust?.phone ?? null,
      current_amount: 0,
      days_1_30: 0,
      days_31_60: 0,
      days_over_60: 0,
      total_outstanding: 0,
      invoice_count: 0,
    };

    if (daysOverdue <= 0) {
      agingSummary.current_amount += remaining;
      row.current_amount += remaining;
    } else if (daysOverdue <= 30) {
      agingSummary.days_1_30 += remaining;
      row.days_1_30 += remaining;
    } else if (daysOverdue <= 60) {
      agingSummary.days_31_60 += remaining;
      row.days_31_60 += remaining;
    } else {
      agingSummary.days_over_60 += remaining;
      row.days_over_60 += remaining;
    }

    agingSummary.total_outstanding += remaining;
    agingSummary.open_invoices_count += 1;

    row.total_outstanding += remaining;
    row.invoice_count += 1;
    customerAgingMap.set(customerId, row);
  }

  const customerAgingRows = Array.from(customerAgingMap.values()).sort(
    (a, b) => b.total_outstanding - a.total_outstanding
  );

  return {
    period,
    salesSummary: {
      grossSales,
      totalDiscount,
      netSales,
      totalOrders,
      avgOrderValue,
      trend: Array.from(trendMap.entries()).map(([key, val]) => ({
        key,
        label: val.label,
        total: val.total,
      })),
      tierBreakdown: Array.from(tierBreakdownMap.values()).sort(
        (a, b) => b.net_sales - a.net_sales
      ),
    },
    topProducts,
    agingSummary,
    customerAgingRows,
  };
}