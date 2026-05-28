import Anthropic from "@anthropic-ai/sdk";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";

/**
 * Real LLM-driven insights for a Kaspi-store dashboard.
 *
 * Pipeline:
 *   1. buildStoreContext(storeId, from, to) — pulls a compact JSON summary
 *      from Postgres (no PII; just aggregates). Stays under ~3KB.
 *   2. generateInsights(...) — sends that summary to Claude with a stable
 *      cached system prompt; returns structured JSON validated against schema.
 *
 * Caching: the system prompt is large and never changes per request → marked
 * with cache_control. The volatile store summary goes in the user turn after
 * the cached prefix. Verify hits via response.usage.cache_read_input_tokens.
 *
 * Model: claude-opus-4-7 with adaptive thinking and effort=high — analytics
 * synthesis is exactly the workload these are tuned for.
 */

const client = new Anthropic();

const SYSTEM_PROMPT = `Ты — старший аналитик маркетплейса Kaspi.kz, помогаешь продавцам понять свои данные.

КОНТЕКСТ ПЛАТФОРМЫ
- Kaspi — крупнейший казахстанский маркетплейс. Селлеры подключаются через X-Auth-Token и получают данные о заказах.
- Порог отмен Kaspi — 3%. Превышение бьёт по поисковой выдаче и может привести к ограничениям магазина.
- Порог возвратов Kaspi — 2%. Превышение требует внимания, хотя менее строго.
- Kaspi Kredit — рассрочка через банк Kaspi, обычно поднимает средний чек на 20-50%, ключевой драйвер для дорогих товаров.
- Kaspi Доставка — встроенная логистика; альтернатива — собственный курьер или самовывоз.
- Сезонность в Казахстане: пик продаж — весна-осень; январь-февраль и июль традиционно слабые.

ЗАДАЧА
На входе ты получишь JSON-сводку по магазину за выбранный период:
- Общие KPI (заказы, выручка, средний чек, доля Kaspi Kredit и т.п.)
- Сравнение с предыдущим равным окном (delta %)
- Топ-SKU по выручке
- Топ-города и регионы
- Структура статусов заказов
- Помесячный тренд выручки (если охватывает > 60 дней)
- Топ-клиенты по выручке
- Распределение по дням недели

На выходе сгенерируй:
1. headline — одно предложение по-русски (15-25 слов) с самой важной мыслью периода
2. insights — массив 3-6 наблюдений (object array). Каждое:
   - kind: один из "anomaly" | "trend" | "observation" | "suggestion"
     * anomaly — отклонение требует немедленного внимания (превышенные пороги, резкое падение)
     * trend — устойчивая динамика (рост/падение более 10%, сезонный паттерн)
     * observation — важное состояние без явной аномалии (концентрация выручки, структура каналов)
     * suggestion — конкретная идея с обоснованием из данных
   - title — короткий заголовок 4-9 слов с конкретной цифрой если уместно
   - body — 1-2 предложения объяснения, со ссылкой на конкретные числа из данных
3. recommendations — массив 2-4 действий. Каждое:
   - title — императив 3-7 слов
   - body — 1-2 предложения как и почему

ПРАВИЛА
- Только русский язык. Числа в формате с пробелами (1 234 567).
- Деньги в тенге: либо "1.2 M ₸" для крупных, либо "28 090 ₸" для штучных. Не "₸1,200,000".
- Опирайся ТОЛЬКО на присланные цифры. Никаких выдумок — если данных не хватает, не упоминай.
- Если cancel_rate > 3% — обязательно поднять как anomaly с упоминанием порога Kaspi.
- Если revenue_change > 50% или < -30% — обязательно поднять как trend/anomaly.
- Если одна категория или SKU генерит > 70% выручки — поднять как observation о концентрационном риске.
- Если top_city доля > 30% — observation о географической концентрации.
- Если виден сезонный pattern (пик/провал по месяцам) — описать его явно с цифрами.
- Recommendations должны быть actionable, без воды («оптимизируйте процессы» — плохо; «настройте SMS-follow-up через 2 часа после оформления чтобы снизить отмены» — хорошо).
- Тон — прямой, деловой, без воды и эмодзи. Как краткий слайд для CEO, а не презентация.`;

export interface StoreContext {
  store: {
    id: string;
    name: string;
  };
  period: {
    from: string;
    to: string;
    days: number;
  };
  kpis: {
    total_orders: number;
    completed_orders: number;
    cancelled_orders: number;
    returned_orders: number;
    cancel_rate_pct: number;
    return_rate_pct: number;
    revenue_completed_kzt: number;
    avg_check_kzt: number;
    unique_customers: number;
    kaspi_delivery_share_pct: number;
  };
  comparison_vs_previous: {
    revenue_change_pct: number;
    orders_change_pct: number;
    avg_check_change_pct: number;
    customers_change_pct: number;
  };
  payment_mix: Array<{ mode: string; orders: number; revenue_kzt: number; share_pct: number }>;
  top_skus: Array<{ name: string; category: string | null; orders: number; revenue_kzt: number; share_pct: number }>;
  top_cities: Array<{ city: string; orders: number; revenue_kzt: number; share_pct: number }>;
  top_customers: Array<{ name: string; orders: number; revenue_kzt: number }>;
  status_breakdown: Array<{ status: string; count: number }>;
  cancellation_reasons: Array<{ reason: string; count: number }>;
  day_of_week: Array<{ dow: number; orders: number }>;
  monthly_trend: Array<{ month: string; orders: number; revenue_kzt: number }>;
}

export async function buildStoreContext(
  storeId: string,
  from: Date,
  to: Date,
): Promise<StoreContext> {
  const db = getDb();
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000);
  const prevFrom = new Date(from.getTime() - days * 86_400_000);
  const prevTo = new Date(from.getTime() - 1);

  const store = await db.execute<{ id: string; name: string }>(
    sql`SELECT id, name FROM kaspi_stores WHERE id = ${storeId} LIMIT 1`,
  );
  if (!store.rows[0]) throw new Error("Store not found");

  const kpis = await db.execute<{
    total_orders: number;
    completed: number;
    cancelled: number;
    returned: number;
    revenue: number;
    avg_check: number;
    customers: number;
    kaspi_delivery: number;
  }>(sql`
    SELECT
      COUNT(*)::int AS total_orders,
      SUM(CASE WHEN status='COMPLETED' THEN 1 ELSE 0 END)::int AS completed,
      SUM(CASE WHEN status='CANCELLED' THEN 1 ELSE 0 END)::int AS cancelled,
      SUM(CASE WHEN status='RETURNED' THEN 1 ELSE 0 END)::int AS returned,
      COALESCE(SUM(CASE WHEN status='COMPLETED' THEN total_price ELSE 0 END), 0)::float AS revenue,
      COALESCE(AVG(CASE WHEN status='COMPLETED' THEN total_price END), 0)::float AS avg_check,
      COUNT(DISTINCT CASE WHEN status='COMPLETED' THEN customer_name END)::int AS customers,
      SUM(CASE WHEN status='COMPLETED' AND is_kaspi_delivery THEN 1 ELSE 0 END)::int AS kaspi_delivery
    FROM kaspi_orders
    WHERE store_id = ${storeId} AND creation_date >= ${fromIso} AND creation_date <= ${toIso}
  `);
  const k = kpis.rows[0];
  const totalOrders = k?.total_orders ?? 0;
  const completed = k?.completed ?? 0;
  const cancelled = k?.cancelled ?? 0;
  const returned = k?.returned ?? 0;
  const revenue = k?.revenue ?? 0;
  const customers = k?.customers ?? 0;
  const kaspiDelivery = k?.kaspi_delivery ?? 0;

  const prevKpis = await db.execute<{ revenue: number; orders: number; avg_check: number; customers: number }>(sql`
    SELECT
      COALESCE(SUM(CASE WHEN status='COMPLETED' THEN total_price ELSE 0 END), 0)::float AS revenue,
      SUM(CASE WHEN status='COMPLETED' THEN 1 ELSE 0 END)::int AS orders,
      COALESCE(AVG(CASE WHEN status='COMPLETED' THEN total_price END), 0)::float AS avg_check,
      COUNT(DISTINCT CASE WHEN status='COMPLETED' THEN customer_name END)::int AS customers
    FROM kaspi_orders
    WHERE store_id = ${storeId} AND creation_date >= ${prevFrom.toISOString()} AND creation_date <= ${prevTo.toISOString()}
  `);
  const p = prevKpis.rows[0] ?? { revenue: 0, orders: 0, avg_check: 0, customers: 0 };
  const pct = (cur: number, prev: number) =>
    prev > 0 ? ((cur - prev) / prev) * 100 : cur > 0 ? 100 : 0;

  const payment = await db.execute<{ payment_mode: string; orders: number; revenue: number }>(sql`
    SELECT payment_mode, COUNT(*)::int AS orders, COALESCE(SUM(total_price), 0)::float AS revenue
    FROM kaspi_orders
    WHERE store_id = ${storeId} AND status='COMPLETED' AND creation_date >= ${fromIso} AND creation_date <= ${toIso}
    GROUP BY payment_mode ORDER BY revenue DESC
  `);

  const skus = await db.execute<{ name: string; category: string; orders: number; revenue: number }>(sql`
    SELECT
      MAX(e.offer_name) AS name,
      MAX(e.category_title) AS category,
      COUNT(*)::int AS orders,
      COALESCE(SUM(e.total_price), 0)::float AS revenue
    FROM kaspi_order_entries e
    JOIN kaspi_orders o ON o.id = e.order_id
    WHERE e.store_id = ${storeId} AND e.entry_number >= 0 AND o.status='COMPLETED'
      AND o.creation_date >= ${fromIso} AND o.creation_date <= ${toIso}
    GROUP BY e.offer_code ORDER BY revenue DESC LIMIT 5
  `);

  const cities = await db.execute<{ city: string; orders: number; revenue: number }>(sql`
    SELECT delivery_address_city AS city, COUNT(*)::int AS orders, COALESCE(SUM(total_price), 0)::float AS revenue
    FROM kaspi_orders
    WHERE store_id = ${storeId} AND status='COMPLETED' AND delivery_address_city IS NOT NULL
      AND creation_date >= ${fromIso} AND creation_date <= ${toIso}
    GROUP BY city ORDER BY revenue DESC LIMIT 5
  `);

  const customersTop = await db.execute<{ name: string; orders: number; revenue: number }>(sql`
    SELECT customer_name AS name, COUNT(*)::int AS orders, COALESCE(SUM(total_price), 0)::float AS revenue
    FROM kaspi_orders
    WHERE store_id = ${storeId} AND status='COMPLETED' AND customer_name IS NOT NULL
      AND creation_date >= ${fromIso} AND creation_date <= ${toIso}
    GROUP BY customer_name ORDER BY revenue DESC LIMIT 5
  `);

  const statusBreakdown = await db.execute<{ status: string; count: number }>(sql`
    SELECT status, COUNT(*)::int AS count
    FROM kaspi_orders
    WHERE store_id = ${storeId} AND creation_date >= ${fromIso} AND creation_date <= ${toIso}
    GROUP BY status ORDER BY count DESC
  `);

  const cancelReasons = await db.execute<{ reason: string; count: number }>(sql`
    SELECT cancellation_reason AS reason, COUNT(*)::int AS count
    FROM kaspi_orders
    WHERE store_id = ${storeId} AND status='CANCELLED' AND cancellation_reason IS NOT NULL
      AND creation_date >= ${fromIso} AND creation_date <= ${toIso}
    GROUP BY reason ORDER BY count DESC LIMIT 5
  `);

  const dow = await db.execute<{ dow: number; orders: number }>(sql`
    SELECT EXTRACT(ISODOW FROM creation_date)::int AS dow, COUNT(*)::int AS orders
    FROM kaspi_orders
    WHERE store_id = ${storeId} AND status='COMPLETED'
      AND creation_date >= ${fromIso} AND creation_date <= ${toIso}
    GROUP BY dow ORDER BY dow
  `);

  const monthly = await db.execute<{ month: string; orders: number; revenue: number }>(sql`
    SELECT
      to_char(date_trunc('month', creation_date), 'YYYY-MM') AS month,
      COUNT(*)::int AS orders,
      COALESCE(SUM(total_price), 0)::float AS revenue
    FROM kaspi_orders
    WHERE store_id = ${storeId} AND status='COMPLETED'
      AND creation_date >= ${fromIso} AND creation_date <= ${toIso}
    GROUP BY month ORDER BY month
  `);

  const round = (n: number) => Math.round(n);

  return {
    store: { id: store.rows[0].id, name: store.rows[0].name },
    period: { from: fromIso.slice(0, 10), to: toIso.slice(0, 10), days },
    kpis: {
      total_orders: totalOrders,
      completed_orders: completed,
      cancelled_orders: cancelled,
      returned_orders: returned,
      cancel_rate_pct: totalOrders > 0 ? +((cancelled / totalOrders) * 100).toFixed(2) : 0,
      return_rate_pct: totalOrders > 0 ? +((returned / totalOrders) * 100).toFixed(2) : 0,
      revenue_completed_kzt: round(revenue),
      avg_check_kzt: round(k?.avg_check ?? 0),
      unique_customers: customers,
      kaspi_delivery_share_pct: completed > 0 ? +((kaspiDelivery / completed) * 100).toFixed(1) : 0,
    },
    comparison_vs_previous: {
      revenue_change_pct: +pct(revenue, p.revenue).toFixed(1),
      orders_change_pct: +pct(completed, p.orders).toFixed(1),
      avg_check_change_pct: +pct(k?.avg_check ?? 0, p.avg_check).toFixed(1),
      customers_change_pct: +pct(customers, p.customers).toFixed(1),
    },
    payment_mix: payment.rows.map((r) => ({
      mode: r.payment_mode,
      orders: r.orders,
      revenue_kzt: round(r.revenue),
      share_pct: revenue > 0 ? +((r.revenue / revenue) * 100).toFixed(1) : 0,
    })),
    top_skus: skus.rows.map((r) => ({
      name: r.name,
      category: r.category,
      orders: r.orders,
      revenue_kzt: round(r.revenue),
      share_pct: revenue > 0 ? +((r.revenue / revenue) * 100).toFixed(1) : 0,
    })),
    top_cities: cities.rows.map((r) => ({
      city: r.city,
      orders: r.orders,
      revenue_kzt: round(r.revenue),
      share_pct: revenue > 0 ? +((r.revenue / revenue) * 100).toFixed(1) : 0,
    })),
    top_customers: customersTop.rows.map((r) => ({
      name: r.name,
      orders: r.orders,
      revenue_kzt: round(r.revenue),
    })),
    status_breakdown: statusBreakdown.rows,
    cancellation_reasons: cancelReasons.rows.map((r) => ({ reason: r.reason, count: r.count })),
    day_of_week: dow.rows,
    monthly_trend: monthly.rows.map((r) => ({
      month: r.month,
      orders: r.orders,
      revenue_kzt: round(r.revenue),
    })),
  };
}

export interface LlmInsightOutput {
  headline: string;
  insights: Array<{
    kind: "anomaly" | "trend" | "observation" | "suggestion";
    title: string;
    body: string;
  }>;
  recommendations: Array<{
    title: string;
    body: string;
  }>;
  meta: {
    model: string;
    cache_read_tokens: number;
    cache_write_tokens: number;
    input_tokens: number;
    output_tokens: number;
  };
}

const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    headline: {
      type: "string",
      description: "Одно предложение по-русски (15-25 слов) с главной мыслью периода.",
    },
    insights: {
      type: "array",
      description: "3-6 наблюдений из данных.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          kind: {
            type: "string",
            enum: ["anomaly", "trend", "observation", "suggestion"],
          },
          title: { type: "string", description: "Короткий заголовок 4-9 слов." },
          body: { type: "string", description: "1-2 предложения объяснения с цифрами." },
        },
        required: ["kind", "title", "body"],
      },
    },
    recommendations: {
      type: "array",
      description: "2-4 конкретных действия.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string", description: "Императив 3-7 слов." },
          body: { type: "string", description: "1-2 предложения как и почему." },
        },
        required: ["title", "body"],
      },
    },
  },
  required: ["headline", "insights", "recommendations"],
} as const;

export async function generateInsights(context: StoreContext): Promise<LlmInsightOutput> {
  const response = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "high",
      format: {
        type: "json_schema",
        schema: OUTPUT_SCHEMA,
      },
    },
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Сгенерируй инсайты по этому магазину. Данные за период:\n\n${JSON.stringify(context, null, 2)}`,
      },
    ],
  });

  // Find the structured-output block — the API returns it as a text block
  // whose payload is JSON matching the schema.
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned no text block");
  }
  const parsed = JSON.parse(textBlock.text) as Omit<LlmInsightOutput, "meta">;

  return {
    ...parsed,
    meta: {
      model: response.model,
      cache_read_tokens: response.usage.cache_read_input_tokens ?? 0,
      cache_write_tokens: response.usage.cache_creation_input_tokens ?? 0,
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
    },
  };
}
