import { sql } from "drizzle-orm";
import { Topbar } from "@/components/topbar";
import { getDb } from "@/lib/db/client";
import { getActiveStore } from "@/lib/active-store";
import { StoryClient } from "./client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * "Live story" page for course demos — a single-URL, dashboard-grade visual
 * narrative of the active store's last 12 months. Designed to drop into a
 * Zoom call: open URL, students immediately see real numbers + charts +
 * narrative, no wait, no loading spinners.
 *
 * Data is fetched fresh from Postgres at request time; the page is server-
 * rendered so first paint already has every chart in the DOM (Recharts
 * hydrates client-side). No LLM call in this path — content is curated from
 * the same aggregates we already power /insights with, so the live demo
 * cannot 500 because of an external API.
 */

type MonthlyRow = { month: string; orders: number; revenue: number } & Record<string, unknown>;
type CancelRow = { month: string; total: number; cancelled: number; rate: number } & Record<string, unknown>;
type CityRow = { city: string; orders: number; revenue: number } & Record<string, unknown>;
type SkuRow = {
  name: string;
  category: string | null;
  units: number;
  revenue: number;
  orders: number;
} & Record<string, unknown>;
type PaymentRow = { payment_mode: string; orders: number; revenue: number } & Record<string, unknown>;
type CustomerFlowRow = {
  month: string;
  new_cust: number;
  repeat_cust: number;
} & Record<string, unknown>;
type CancelReasonRow = { reason: string; count: number } & Record<string, unknown>;

export interface StoryData {
  storeName: string;
  totalOrders: number;
  completed: number;
  cancelled: number;
  returned: number;
  revenue: number;
  avgCheck: number;
  uniqueCustomers: number;
  cancelRate: number;
  returnRate: number;
  monthly: MonthlyRow[];
  cancelByMonth: CancelRow[];
  cities: CityRow[];
  skus: SkuRow[];
  paymentMix: PaymentRow[];
  customerFlow: CustomerFlowRow[];
  cancelReasons: CancelReasonRow[];
}

async function fetchStory(storeId: string, storeName: string): Promise<StoryData> {
  const db = getDb();
  const S = storeId;

  const headline = await db.execute<{
    total: number;
    completed: number;
    cancelled: number;
    returned: number;
    revenue: number;
    avg_check: number;
    customers: number;
  }>(sql`
    SELECT
      COUNT(*)::int AS total,
      SUM(CASE WHEN status='COMPLETED' THEN 1 ELSE 0 END)::int AS completed,
      SUM(CASE WHEN status='CANCELLED' THEN 1 ELSE 0 END)::int AS cancelled,
      SUM(CASE WHEN status='RETURNED' THEN 1 ELSE 0 END)::int AS returned,
      COALESCE(SUM(CASE WHEN status='COMPLETED' THEN total_price ELSE 0 END), 0)::float AS revenue,
      COALESCE(AVG(CASE WHEN status='COMPLETED' THEN total_price END), 0)::float AS avg_check,
      COUNT(DISTINCT CASE WHEN status='COMPLETED' THEN customer_name END)::int AS customers
    FROM kaspi_orders WHERE store_id=${S}
  `);
  const h = headline.rows[0];

  const monthly = await db.execute<MonthlyRow>(sql`
    SELECT
      to_char(date_trunc('month', creation_date), 'YYYY-MM') AS month,
      COUNT(*)::int AS orders,
      COALESCE(SUM(total_price), 0)::float AS revenue
    FROM kaspi_orders WHERE store_id=${S} AND status='COMPLETED'
    GROUP BY month ORDER BY month
  `);

  const cancelMonthly = await db.execute<CancelRow>(sql`
    SELECT
      to_char(date_trunc('month', creation_date), 'YYYY-MM') AS month,
      COUNT(*)::int AS total,
      SUM(CASE WHEN status='CANCELLED' THEN 1 ELSE 0 END)::int AS cancelled,
      (SUM(CASE WHEN status='CANCELLED' THEN 1 ELSE 0 END)::float / NULLIF(COUNT(*), 0) * 100)::float AS rate
    FROM kaspi_orders WHERE store_id=${S}
    GROUP BY month ORDER BY month
  `);

  const cities = await db.execute<CityRow>(sql`
    SELECT delivery_address_city AS city, COUNT(*)::int AS orders, COALESCE(SUM(total_price), 0)::float AS revenue
    FROM kaspi_orders
    WHERE store_id=${S} AND status='COMPLETED' AND delivery_address_city IS NOT NULL
    GROUP BY city ORDER BY revenue DESC LIMIT 10
  `);

  const skus = await db.execute<SkuRow>(sql`
    SELECT
      MAX(e.offer_name) AS name,
      MAX(e.category_title) AS category,
      SUM(e.quantity)::int AS units,
      COALESCE(SUM(e.total_price), 0)::float AS revenue,
      COUNT(*)::int AS orders
    FROM kaspi_order_entries e
    JOIN kaspi_orders o ON o.id = e.order_id
    WHERE e.store_id=${S} AND e.entry_number >= 0 AND o.status='COMPLETED'
    GROUP BY e.offer_code ORDER BY revenue DESC
  `);

  const payment = await db.execute<PaymentRow>(sql`
    SELECT payment_mode, COUNT(*)::int AS orders, COALESCE(SUM(total_price), 0)::float AS revenue
    FROM kaspi_orders WHERE store_id=${S} AND status='COMPLETED'
    GROUP BY payment_mode ORDER BY revenue DESC
  `);

  const flow = await db.execute<CustomerFlowRow>(sql`
    WITH first AS (
      SELECT customer_name, MIN(creation_date) AS first_order
      FROM kaspi_orders WHERE store_id=${S} AND status='COMPLETED' AND customer_name IS NOT NULL
      GROUP BY customer_name
    ),
    monthly AS (
      SELECT to_char(date_trunc('month', o.creation_date), 'YYYY-MM') AS month, o.customer_name,
        CASE WHEN date_trunc('month', f.first_order) = date_trunc('month', o.creation_date) THEN 1 ELSE 0 END AS is_new
      FROM kaspi_orders o JOIN first f ON f.customer_name = o.customer_name
      WHERE o.store_id=${S} AND o.status='COMPLETED'
      GROUP BY month, o.customer_name, f.first_order, o.creation_date
    )
    SELECT month, SUM(is_new)::int AS new_cust, SUM(1-is_new)::int AS repeat_cust
    FROM monthly GROUP BY month ORDER BY month
  `);

  const reasons = await db.execute<CancelReasonRow>(sql`
    SELECT cancellation_reason AS reason, COUNT(*)::int AS count
    FROM kaspi_orders
    WHERE store_id=${S} AND status='CANCELLED' AND cancellation_reason IS NOT NULL
    GROUP BY reason ORDER BY count DESC LIMIT 5
  `);

  return {
    storeName,
    totalOrders: h?.total ?? 0,
    completed: h?.completed ?? 0,
    cancelled: h?.cancelled ?? 0,
    returned: h?.returned ?? 0,
    revenue: h?.revenue ?? 0,
    avgCheck: h?.avg_check ?? 0,
    uniqueCustomers: h?.customers ?? 0,
    cancelRate: h?.total ? ((h.cancelled / h.total) * 100) : 0,
    returnRate: h?.total ? ((h.returned / h.total) * 100) : 0,
    monthly: monthly.rows,
    cancelByMonth: cancelMonthly.rows,
    cities: cities.rows,
    skus: skus.rows,
    paymentMix: payment.rows,
    customerFlow: flow.rows,
    cancelReasons: reasons.rows,
  };
}

export default async function StoryPage() {
  const store = await getActiveStore();
  if (!store) {
    return (
      <>
        <Topbar title="История магазина" subtitle="нет активного магазина" />
        <div className="mx-auto max-w-2xl px-6 py-12 text-[14px] text-[var(--text-dim)]">
          Подключите магазин — раздел «Магазины» в сайдбаре.
        </div>
      </>
    );
  }

  const data = await fetchStory(store.id, store.name);

  return <StoryClient data={data} />;
}
