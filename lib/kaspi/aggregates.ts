/**
 * Analytics aggregates for a single store.
 *
 * Full port of 27 endpoints from RedStat kaspi_analytics_routes.py.
 * All queries parametrized by store_id + [dateFrom, dateTo].
 *
 * === REVENUE POLICY ===
 * "Выручка" = sum of total_price WHERE status = 'COMPLETED'.
 * Cancelled / returned / in-progress orders are NEVER counted as revenue —
 * industry standard for e-commerce reporting. Rate aggregates (cancellation,
 * return, status breakdown) use all statuses because they need the full denominator.
 */
import { sql } from "drizzle-orm";
import { getDb } from "../db/client";
import { classifyCityToOblast, OBLAST_NAMES, type OblastCode } from "./kz-oblasts";

export type Period = "daily" | "weekly" | "monthly";

const PERIOD_MAP: Record<Period, string> = {
  daily: "day",
  weekly: "week",
  monthly: "month",
};

export interface Range {
  storeId: string;
  from: Date;
  to: Date;
}

/* ────────────────────────────────────────────────────────────────
   REVENUE (4)
   All filter status = 'COMPLETED' for revenue correctness.
   ──────────────────────────────────────────────────────────────── */

export async function revenueByPeriod({ storeId, from, to }: Range, period: Period = "daily") {
  const trunc = PERIOD_MAP[period];
  const { rows } = await getDb().execute<{ period: string; revenue: number; orders: number }>(sql`
    SELECT
      to_char(date_trunc(${trunc}, creation_date), 'YYYY-MM-DD') AS period,
      COALESCE(SUM(total_price), 0)::float AS revenue,
      COUNT(*)::int AS orders
    FROM kaspi_orders
    WHERE store_id = ${storeId}
      AND creation_date >= ${from.toISOString()}
      AND creation_date <= ${to.toISOString()}
      AND status = 'COMPLETED'
    GROUP BY 1
    ORDER BY 1
  `);
  return rows;
}

export async function revenueByPaymentMode({ storeId, from, to }: Range) {
  const { rows } = await getDb().execute<{ payment_mode: string | null; revenue: number; orders: number }>(sql`
    SELECT
      payment_mode,
      COALESCE(SUM(total_price), 0)::float AS revenue,
      COUNT(*)::int AS orders
    FROM kaspi_orders
    WHERE store_id = ${storeId}
      AND creation_date >= ${from.toISOString()}
      AND creation_date <= ${to.toISOString()}
      AND status = 'COMPLETED'
    GROUP BY payment_mode
    ORDER BY revenue DESC
  `);
  return rows;
}

export async function revenueByDeliveryMode({ storeId, from, to }: Range) {
  const { rows } = await getDb().execute<{ delivery_mode: string | null; revenue: number; orders: number }>(sql`
    SELECT
      delivery_mode,
      COALESCE(SUM(total_price), 0)::float AS revenue,
      COUNT(*)::int AS orders
    FROM kaspi_orders
    WHERE store_id = ${storeId}
      AND creation_date >= ${from.toISOString()}
      AND creation_date <= ${to.toISOString()}
      AND status = 'COMPLETED'
    GROUP BY delivery_mode
    ORDER BY revenue DESC
  `);
  return rows;
}

export async function avgOrderValueByPeriod({ storeId, from, to }: Range, period: Period = "daily") {
  const trunc = PERIOD_MAP[period];
  const { rows } = await getDb().execute<{ period: string; avg_value: number }>(sql`
    SELECT
      to_char(date_trunc(${trunc}, creation_date), 'YYYY-MM-DD') AS period,
      COALESCE(AVG(total_price), 0)::float AS avg_value
    FROM kaspi_orders
    WHERE store_id = ${storeId}
      AND creation_date >= ${from.toISOString()}
      AND creation_date <= ${to.toISOString()}
      AND status = 'COMPLETED'
    GROUP BY 1
    ORDER BY 1
  `);
  return rows;
}

/* ────────────────────────────────────────────────────────────────
   ORDERS (5)
   Mix: status breakdown uses ALL (need total for rates). Revenue column filters COMPLETED.
   ──────────────────────────────────────────────────────────────── */

export async function ordersByStatus({ storeId, from, to }: Range) {
  const { rows } = await getDb().execute<{ status: string; count: number; revenue: number }>(sql`
    SELECT
      status,
      COUNT(*)::int AS count,
      COALESCE(SUM(total_price), 0)::float AS revenue
    FROM kaspi_orders
    WHERE store_id = ${storeId}
      AND creation_date >= ${from.toISOString()}
      AND creation_date <= ${to.toISOString()}
    GROUP BY status
    ORDER BY count DESC
  `);
  return rows;
}

export async function cancellationRateByPeriod({ storeId, from, to }: Range, period: Period = "daily") {
  const trunc = PERIOD_MAP[period];
  const { rows } = await getDb().execute<{ period: string; total: number; cancelled: number; rate: number }>(sql`
    SELECT
      to_char(date_trunc(${trunc}, creation_date), 'YYYY-MM-DD') AS period,
      COUNT(*)::int AS total,
      SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END)::int AS cancelled,
      (SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0) * 100)::float AS rate
    FROM kaspi_orders
    WHERE store_id = ${storeId}
      AND creation_date >= ${from.toISOString()}
      AND creation_date <= ${to.toISOString()}
    GROUP BY 1
    ORDER BY 1
  `);
  return rows;
}

export async function returnRateByPeriod({ storeId, from, to }: Range, period: Period = "daily") {
  const trunc = PERIOD_MAP[period];
  const { rows } = await getDb().execute<{ period: string; total: number; returned: number; rate: number }>(sql`
    SELECT
      to_char(date_trunc(${trunc}, creation_date), 'YYYY-MM-DD') AS period,
      COUNT(*)::int AS total,
      SUM(CASE WHEN status = 'RETURNED' THEN 1 ELSE 0 END)::int AS returned,
      (SUM(CASE WHEN status = 'RETURNED' THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0) * 100)::float AS rate
    FROM kaspi_orders
    WHERE store_id = ${storeId}
      AND creation_date >= ${from.toISOString()}
      AND creation_date <= ${to.toISOString()}
    GROUP BY 1
    ORDER BY 1
  `);
  return rows;
}

export async function ordersByDayOfWeek({ storeId, from, to }: Range) {
  const { rows } = await getDb().execute<{ dow: number; count: number; revenue: number }>(sql`
    SELECT
      EXTRACT(ISODOW FROM creation_date)::int AS dow,
      COUNT(*)::int AS count,
      COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN total_price ELSE 0 END), 0)::float AS revenue
    FROM kaspi_orders
    WHERE store_id = ${storeId}
      AND creation_date >= ${from.toISOString()}
      AND creation_date <= ${to.toISOString()}
    GROUP BY dow
    ORDER BY dow
  `);
  return rows;
}

export async function ordersByHour({ storeId, from, to }: Range) {
  const { rows } = await getDb().execute<{ hour: number; count: number; revenue: number }>(sql`
    SELECT
      EXTRACT(HOUR FROM creation_date)::int AS hour,
      COUNT(*)::int AS count,
      COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN total_price ELSE 0 END), 0)::float AS revenue
    FROM kaspi_orders
    WHERE store_id = ${storeId}
      AND creation_date >= ${from.toISOString()}
      AND creation_date <= ${to.toISOString()}
    GROUP BY hour
    ORDER BY hour
  `);
  return rows;
}

/* ────────────────────────────────────────────────────────────────
   DELIVERY (5)
   Delivery cost occurs on COMPLETED orders; cancelled doesn't incur cost.
   ──────────────────────────────────────────────────────────────── */

export async function deliveryCostByPeriod({ storeId, from, to }: Range, period: Period = "monthly") {
  const trunc = PERIOD_MAP[period];
  const { rows } = await getDb().execute<{
    period: string;
    seller_cost: number;
    buyer_cost: number;
  }>(sql`
    SELECT
      to_char(date_trunc(${trunc}, creation_date), 'YYYY-MM-DD') AS period,
      COALESCE(SUM(delivery_cost_for_seller), 0)::float AS seller_cost,
      COALESCE(SUM(delivery_cost), 0)::float AS buyer_cost
    FROM kaspi_orders
    WHERE store_id = ${storeId}
      AND creation_date >= ${from.toISOString()}
      AND creation_date <= ${to.toISOString()}
      AND status = 'COMPLETED'
    GROUP BY 1
    ORDER BY 1
  `);
  return rows;
}

export async function deliveryExpressSplit({ storeId, from, to }: Range) {
  const { rows } = await getDb().execute<{ is_express: boolean; count: number; revenue: number }>(sql`
    SELECT
      is_express,
      COUNT(*)::int AS count,
      COALESCE(SUM(total_price), 0)::float AS revenue
    FROM kaspi_orders
    WHERE store_id = ${storeId}
      AND creation_date >= ${from.toISOString()}
      AND creation_date <= ${to.toISOString()}
      AND status = 'COMPLETED'
    GROUP BY is_express
    ORDER BY count DESC
  `);
  return rows;
}

export async function deliveryByCity({ storeId, from, to }: Range, limit = 20) {
  const { rows } = await getDb().execute<{ city: string | null; count: number; revenue: number }>(sql`
    SELECT
      delivery_address_city AS city,
      COUNT(*)::int AS count,
      COALESCE(SUM(total_price), 0)::float AS revenue
    FROM kaspi_orders
    WHERE store_id = ${storeId}
      AND creation_date >= ${from.toISOString()}
      AND creation_date <= ${to.toISOString()}
      AND status = 'COMPLETED'
      AND delivery_address_city IS NOT NULL
    GROUP BY city
    ORDER BY revenue DESC
    LIMIT ${limit}
  `);
  return rows;
}

export interface OblastRow {
  oblast_code: OblastCode;
  oblast_name: string;
  count: number;
  revenue: number;
  avg_check: number;
  cities: { city: string; orders: number; revenue: number }[];
}

export async function deliveryByOblast(range: Range): Promise<OblastRow[]> {
  const cityRows = await deliveryByCity(range, 500);
  const agg = new Map<OblastCode, OblastRow>();
  for (const r of cityRows) {
    const code = classifyCityToOblast(r.city);
    if (!agg.has(code)) {
      agg.set(code, {
        oblast_code: code,
        oblast_name: OBLAST_NAMES[code],
        count: 0,
        revenue: 0,
        avg_check: 0,
        cities: [],
      });
    }
    const o = agg.get(code)!;
    o.count += r.count;
    o.revenue += r.revenue;
    o.cities.push({ city: r.city ?? "—", orders: r.count, revenue: r.revenue });
  }
  const arr = Array.from(agg.values());
  for (const o of arr) {
    o.avg_check = o.count > 0 ? o.revenue / o.count : 0;
    o.cities.sort((a, b) => b.revenue - a.revenue);
  }
  arr.sort((a, b) => b.revenue - a.revenue);
  return arr;
}

export async function deliveryAvgCost({ storeId, from, to }: Range) {
  const { rows } = await getDb().execute<{ avg_seller_cost: number; avg_buyer_cost: number }>(sql`
    SELECT
      COALESCE(AVG(delivery_cost_for_seller), 0)::float AS avg_seller_cost,
      COALESCE(AVG(delivery_cost), 0)::float AS avg_buyer_cost
    FROM kaspi_orders
    WHERE store_id = ${storeId}
      AND creation_date >= ${from.toISOString()}
      AND creation_date <= ${to.toISOString()}
      AND status = 'COMPLETED'
  `);
  return rows[0] ?? { avg_seller_cost: 0, avg_buyer_cost: 0 };
}

/* ────────────────────────────────────────────────────────────────
   CUSTOMERS (4)
   A customer is someone who COMPLETED at least one order.
   Kaspi obfuscates phone — we group by customer_name.
   ──────────────────────────────────────────────────────────────── */

export async function customerRepeatCount({ storeId, from, to }: Range) {
  const { rows } = await getDb().execute<{
    total_customers: number;
    repeat_customers: number;
    one_time_customers: number;
  }>(sql`
    WITH per_customer AS (
      SELECT customer_name, COUNT(*) AS orders
      FROM kaspi_orders
      WHERE store_id = ${storeId}
        AND creation_date >= ${from.toISOString()}
        AND creation_date <= ${to.toISOString()}
        AND status = 'COMPLETED'
        AND customer_name IS NOT NULL
      GROUP BY customer_name
    )
    SELECT
      COUNT(*)::int AS total_customers,
      SUM(CASE WHEN orders >= 2 THEN 1 ELSE 0 END)::int AS repeat_customers,
      SUM(CASE WHEN orders = 1 THEN 1 ELSE 0 END)::int AS one_time_customers
    FROM per_customer
  `);
  return rows[0] ?? { total_customers: 0, repeat_customers: 0, one_time_customers: 0 };
}

export async function topCustomers({ storeId, from, to }: Range, limit = 20) {
  const { rows } = await getDb().execute<{
    name: string | null;
    orders: number;
    revenue: number;
    avg_check: number;
    last_order_date: string;
  }>(sql`
    SELECT
      customer_name AS name,
      COUNT(*)::int AS orders,
      COALESCE(SUM(total_price), 0)::float AS revenue,
      COALESCE(AVG(total_price), 0)::float AS avg_check,
      to_char(MAX(creation_date), 'YYYY-MM-DD') AS last_order_date
    FROM kaspi_orders
    WHERE store_id = ${storeId}
      AND creation_date >= ${from.toISOString()}
      AND creation_date <= ${to.toISOString()}
      AND status = 'COMPLETED'
      AND customer_name IS NOT NULL
    GROUP BY name
    ORDER BY revenue DESC
    LIMIT ${limit}
  `);
  return rows;
}

export async function newVsReturningByPeriod({ storeId, from, to }: Range, period: Period = "monthly") {
  const trunc = PERIOD_MAP[period];
  const { rows } = await getDb().execute<{ period: string; new_customers: number; returning_customers: number }>(sql`
    WITH first_seen AS (
      SELECT customer_name, MIN(creation_date) AS first_order
      FROM kaspi_orders
      WHERE store_id = ${storeId}
        AND status = 'COMPLETED'
        AND customer_name IS NOT NULL
      GROUP BY customer_name
    ),
    period_customers AS (
      SELECT
        to_char(date_trunc(${trunc}, o.creation_date), 'YYYY-MM-DD') AS period,
        o.customer_name,
        CASE WHEN date_trunc(${trunc}, f.first_order) = date_trunc(${trunc}, o.creation_date) THEN 1 ELSE 0 END AS is_new
      FROM kaspi_orders o
      JOIN first_seen f ON f.customer_name = o.customer_name
      WHERE o.store_id = ${storeId}
        AND o.creation_date >= ${from.toISOString()}
        AND o.creation_date <= ${to.toISOString()}
        AND o.status = 'COMPLETED'
        AND o.customer_name IS NOT NULL
      GROUP BY period, o.customer_name, f.first_order, o.creation_date
    )
    SELECT
      period,
      SUM(is_new)::int AS new_customers,
      SUM(1 - is_new)::int AS returning_customers
    FROM period_customers
    GROUP BY period
    ORDER BY period
  `);
  return rows;
}

export async function customerOrdersDistribution({ storeId, from, to }: Range) {
  const { rows } = await getDb().execute<{ bucket: string; customers: number }>(sql`
    WITH per_customer AS (
      SELECT customer_name, COUNT(*) AS orders
      FROM kaspi_orders
      WHERE store_id = ${storeId}
        AND creation_date >= ${from.toISOString()}
        AND creation_date <= ${to.toISOString()}
        AND status = 'COMPLETED'
        AND customer_name IS NOT NULL
      GROUP BY customer_name
    )
    SELECT bucket, COUNT(*)::int AS customers
    FROM (
      SELECT CASE
        WHEN orders = 1 THEN '1'
        WHEN orders = 2 THEN '2'
        WHEN orders BETWEEN 3 AND 5 THEN '3–5'
        WHEN orders BETWEEN 6 AND 10 THEN '6–10'
        ELSE '11+'
      END AS bucket
      FROM per_customer
    ) t
    GROUP BY bucket
    ORDER BY CASE bucket
      WHEN '1' THEN 1 WHEN '2' THEN 2 WHEN '3–5' THEN 3
      WHEN '6–10' THEN 4 WHEN '11+' THEN 5 END
  `);
  return rows;
}

/* ────────────────────────────────────────────────────────────────
   CREDIT (2)
   ──────────────────────────────────────────────────────────────── */

export async function creditSplit({ storeId, from, to }: Range) {
  const { rows } = await getDb().execute<{
    payment_mode: string | null;
    orders: number;
    revenue: number;
    avg_check: number;
  }>(sql`
    SELECT
      payment_mode,
      COUNT(*)::int AS orders,
      COALESCE(SUM(total_price), 0)::float AS revenue,
      COALESCE(AVG(total_price), 0)::float AS avg_check
    FROM kaspi_orders
    WHERE store_id = ${storeId}
      AND creation_date >= ${from.toISOString()}
      AND creation_date <= ${to.toISOString()}
      AND status = 'COMPLETED'
    GROUP BY payment_mode
    ORDER BY revenue DESC
  `);
  return rows;
}

export async function creditByTerm({ storeId, from, to }: Range) {
  const { rows } = await getDb().execute<{ credit_term: number | null; orders: number; revenue: number; avg_check: number }>(sql`
    SELECT
      credit_term,
      COUNT(*)::int AS orders,
      COALESCE(SUM(total_price), 0)::float AS revenue,
      COALESCE(AVG(total_price), 0)::float AS avg_check
    FROM kaspi_orders
    WHERE store_id = ${storeId}
      AND creation_date >= ${from.toISOString()}
      AND creation_date <= ${to.toISOString()}
      AND status = 'COMPLETED'
      AND payment_mode = 'PAY_WITH_CREDIT'
    GROUP BY credit_term
    ORDER BY credit_term NULLS LAST
  `);
  return rows;
}

/* ────────────────────────────────────────────────────────────────
   DASHBOARD — summary + period comparison + top days
   Already uses status = 'COMPLETED' for revenue columns.
   ──────────────────────────────────────────────────────────────── */

export interface DashboardKpis {
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  returnedOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  uniqueCustomers: number;
  cancellationRate: number;
  returnRate: number;
  kaspiDeliveryShare: number;
  totalDeliveryCost: number;
}

export async function dashboardKpis({ storeId, from, to }: Range): Promise<DashboardKpis> {
  const { rows } = await getDb().execute<{
    total_orders: number;
    completed_orders: number;
    cancelled_orders: number;
    returned_orders: number;
    total_revenue: number;
    avg_order_value: number;
    unique_customers: number;
    kaspi_delivery: number;
    total_delivery_cost: number;
  }>(sql`
    SELECT
      COUNT(*)::int AS total_orders,
      SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END)::int AS completed_orders,
      SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END)::int AS cancelled_orders,
      SUM(CASE WHEN status = 'RETURNED' THEN 1 ELSE 0 END)::int AS returned_orders,
      COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN total_price ELSE 0 END), 0)::float AS total_revenue,
      COALESCE(AVG(CASE WHEN status = 'COMPLETED' THEN total_price END), 0)::float AS avg_order_value,
      COUNT(DISTINCT CASE WHEN status = 'COMPLETED' THEN customer_name END)::int AS unique_customers,
      SUM(CASE WHEN is_kaspi_delivery AND status = 'COMPLETED' THEN 1 ELSE 0 END)::int AS kaspi_delivery,
      COALESCE(SUM(CASE WHEN status = 'COMPLETED' THEN delivery_cost_for_seller ELSE 0 END), 0)::float AS total_delivery_cost
    FROM kaspi_orders
    WHERE store_id = ${storeId}
      AND creation_date >= ${from.toISOString()}
      AND creation_date <= ${to.toISOString()}
  `);
  const r = rows[0];
  if (!r) {
    return {
      totalOrders: 0, completedOrders: 0, cancelledOrders: 0, returnedOrders: 0,
      totalRevenue: 0, avgOrderValue: 0, uniqueCustomers: 0,
      cancellationRate: 0, returnRate: 0, kaspiDeliveryShare: 0, totalDeliveryCost: 0,
    };
  }
  const total = r.total_orders;
  return {
    totalOrders: total,
    completedOrders: r.completed_orders,
    cancelledOrders: r.cancelled_orders,
    returnedOrders: r.returned_orders,
    totalRevenue: r.total_revenue,
    avgOrderValue: r.avg_order_value,
    uniqueCustomers: r.unique_customers,
    cancellationRate: total > 0 ? (r.cancelled_orders / total) * 100 : 0,
    returnRate: total > 0 ? (r.returned_orders / total) * 100 : 0,
    kaspiDeliveryShare: r.completed_orders > 0 ? (r.kaspi_delivery / r.completed_orders) * 100 : 0,
    totalDeliveryCost: r.total_delivery_cost,
  };
}

export interface PeriodComparison {
  current: DashboardKpis;
  previous: DashboardKpis;
  changes: {
    revenue: number;
    orders: number;
    avgOrderValue: number;
    customers: number;
  };
}

export async function periodComparison(range: Range): Promise<PeriodComparison> {
  const duration = range.to.getTime() - range.from.getTime();
  const prev = {
    storeId: range.storeId,
    from: new Date(range.from.getTime() - duration),
    to: new Date(range.from.getTime() - 1),
  };
  const [current, previous] = await Promise.all([dashboardKpis(range), dashboardKpis(prev)]);
  const pct = (cur: number, p: number) => (p > 0 ? ((cur - p) / p) * 100 : cur > 0 ? 100 : 0);
  return {
    current,
    previous,
    changes: {
      revenue: pct(current.totalRevenue, previous.totalRevenue),
      orders: pct(current.completedOrders, previous.completedOrders),
      avgOrderValue: pct(current.avgOrderValue, previous.avgOrderValue),
      customers: pct(current.uniqueCustomers, previous.uniqueCustomers),
    },
  };
}

export async function topDays({ storeId, from, to }: Range, limit = 10) {
  const { rows } = await getDb().execute<{
    day: string;
    orders: number;
    revenue: number;
    avg_check: number;
    dow: number;
  }>(sql`
    SELECT
      to_char(date_trunc('day', creation_date), 'YYYY-MM-DD') AS day,
      COUNT(*)::int AS orders,
      COALESCE(SUM(total_price), 0)::float AS revenue,
      COALESCE(AVG(total_price), 0)::float AS avg_check,
      EXTRACT(ISODOW FROM date_trunc('day', creation_date))::int AS dow
    FROM kaspi_orders
    WHERE store_id = ${storeId}
      AND creation_date >= ${from.toISOString()}
      AND creation_date <= ${to.toISOString()}
      AND status = 'COMPLETED'
    GROUP BY 1, dow
    ORDER BY revenue DESC
    LIMIT ${limit}
  `);
  return rows;
}

/* ────────────────────────────────────────────────────────────────
   STORES COMPARISON
   ──────────────────────────────────────────────────────────────── */

export async function storesComparison(from: Date, to: Date) {
  const { rows } = await getDb().execute<{
    store_id: string;
    store_name: string;
    orders: number;
    revenue: number;
    avg_check: number;
    cancel_rate: number;
    return_rate: number;
    kaspi_delivery_pct: number;
  }>(sql`
    SELECT
      s.id AS store_id,
      s.name AS store_name,
      SUM(CASE WHEN o.status = 'COMPLETED' THEN 1 ELSE 0 END)::int AS orders,
      COALESCE(SUM(CASE WHEN o.status = 'COMPLETED' THEN o.total_price ELSE 0 END), 0)::float AS revenue,
      COALESCE(AVG(CASE WHEN o.status = 'COMPLETED' THEN o.total_price END), 0)::float AS avg_check,
      (SUM(CASE WHEN o.status = 'CANCELLED' THEN 1 ELSE 0 END)::float / NULLIF(COUNT(o.*), 0) * 100)::float AS cancel_rate,
      (SUM(CASE WHEN o.status = 'RETURNED' THEN 1 ELSE 0 END)::float / NULLIF(COUNT(o.*), 0) * 100)::float AS return_rate,
      (SUM(CASE WHEN o.is_kaspi_delivery AND o.status = 'COMPLETED' THEN 1 ELSE 0 END)::float
        / NULLIF(SUM(CASE WHEN o.status = 'COMPLETED' THEN 1 ELSE 0 END), 0) * 100)::float AS kaspi_delivery_pct
    FROM kaspi_stores s
    LEFT JOIN kaspi_orders o
      ON o.store_id = s.id
      AND o.creation_date >= ${from.toISOString()}
      AND o.creation_date <= ${to.toISOString()}
    GROUP BY s.id, s.name
    ORDER BY revenue DESC NULLS LAST
  `);
  return rows;
}
