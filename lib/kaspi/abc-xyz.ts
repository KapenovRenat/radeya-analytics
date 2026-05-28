/**
 * ABC and XYZ analysis over order line entries.
 *
 * ABC — Pareto classification by revenue share:
 *   A = top 80% of cumulative revenue
 *   B = next 15% (up to 95%)
 *   C = last 5%
 *
 * XYZ — coefficient of variation of demand over calendar weeks:
 *   X = CV < 10%   (stable, predictable)
 *   Y = CV 10–25%  (moderately variable, seasonal)
 *   Z = CV > 25%   (erratic, hard to forecast)
 *
 * Combined 3×3 matrix (9 cells):
 *   AX — cash cows (stable high revenue): maintain stock, priority
 *   AY — valuable but variable: monitor seasonality
 *   AZ — risky stars: high revenue but unpredictable, buffer stock
 *   BX — stable B: systematic reorder
 *   BY — standard
 *   BZ — watch list
 *   CX — predictable but low revenue: automate
 *   CY — review necessity
 *   CZ — dead stock candidate: consider discontinuation
 */
import { sql } from "drizzle-orm";
import { getDb } from "../db/client";

export type ABC = "A" | "B" | "C";
export type XYZ = "X" | "Y" | "Z";

export interface SkuAnalysisRow {
  offer_code: string;
  offer_name: string;
  category: string | null;
  units_sold: number;
  orders: number;
  revenue: number;
  avg_price: number;
  first_sale: string;
  last_sale: string;
  weeks_active: number;
  weekly_mean: number;
  weekly_stdev: number;
  cv: number;
  abc: ABC;
  xyz: XYZ;
  revenue_share_pct: number;
  cumulative_share_pct: number;
}

export interface SkuRange {
  storeId: string;
  from: Date;
  to: Date;
}

interface RawSkuRow extends Record<string, unknown> {
  offer_code: string;
  offer_name: string | null;
  category_title: string | null;
  units_sold: number;
  orders: number;
  revenue: number;
  avg_price: number;
  first_sale: string;
  last_sale: string;
  weekly_mean: number;
  weekly_stdev: number;
  weeks_active: number;
}

/**
 * Fetches per-SKU aggregates with per-week revenue stats for the given period.
 * Classifies each SKU into ABC + XYZ cells.
 */
export async function skuAbcXyzAnalysis(range: SkuRange): Promise<SkuAnalysisRow[]> {
  const db = getDb();

  // One big query: aggregate per offer_code, compute weekly revenue stddev/mean.
  const { rows } = await db.execute<RawSkuRow>(sql`
    WITH per_entry AS (
      SELECT
        e.offer_code,
        e.offer_name,
        e.category_title,
        o.creation_date,
        e.quantity,
        e.total_price
      FROM kaspi_order_entries e
      JOIN kaspi_orders o ON o.id = e.order_id
      WHERE e.store_id = ${range.storeId}
        AND e.offer_code IS NOT NULL
        AND e.entry_number >= 0
        AND o.status = 'COMPLETED'
        AND o.creation_date >= ${range.from.toISOString()}
        AND o.creation_date <= ${range.to.toISOString()}
    ),
    per_week_sku AS (
      SELECT
        offer_code,
        date_trunc('week', creation_date) AS wk,
        SUM(total_price)::float AS weekly_revenue
      FROM per_entry
      GROUP BY offer_code, wk
    ),
    weekly_stats AS (
      SELECT
        offer_code,
        AVG(weekly_revenue)::float AS weekly_mean,
        COALESCE(STDDEV_POP(weekly_revenue), 0)::float AS weekly_stdev,
        COUNT(*)::int AS weeks_active
      FROM per_week_sku
      GROUP BY offer_code
    ),
    totals AS (
      SELECT
        offer_code,
        MAX(offer_name) AS offer_name,
        MAX(category_title) AS category_title,
        SUM(quantity)::int AS units_sold,
        COUNT(*)::int AS orders,
        SUM(total_price)::float AS revenue,
        AVG(total_price)::float AS avg_price,
        to_char(MIN(creation_date), 'YYYY-MM-DD') AS first_sale,
        to_char(MAX(creation_date), 'YYYY-MM-DD') AS last_sale
      FROM per_entry
      GROUP BY offer_code
    )
    SELECT
      t.offer_code,
      t.offer_name,
      t.category_title,
      t.units_sold,
      t.orders,
      t.revenue,
      t.avg_price,
      t.first_sale,
      t.last_sale,
      COALESCE(w.weekly_mean, 0) AS weekly_mean,
      COALESCE(w.weekly_stdev, 0) AS weekly_stdev,
      COALESCE(w.weeks_active, 0) AS weeks_active
    FROM totals t
    LEFT JOIN weekly_stats w USING (offer_code)
    ORDER BY t.revenue DESC
  `);

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  let cumulative = 0;

  const result: SkuAnalysisRow[] = rows.map((r) => {
    const share = totalRevenue > 0 ? (r.revenue / totalRevenue) * 100 : 0;
    cumulative += share;
    const abc: ABC = cumulative <= 80 ? "A" : cumulative <= 95 ? "B" : "C";

    // CV: stdev / mean × 100. For SKUs with < 3 weeks of data we cannot reliably
    // classify — mark as Z (erratic) to be safe.
    let xyz: XYZ;
    if (r.weeks_active < 3 || r.weekly_mean <= 0) {
      xyz = "Z";
    } else {
      const cv = (r.weekly_stdev / r.weekly_mean) * 100;
      xyz = cv < 10 ? "X" : cv <= 25 ? "Y" : "Z";
    }
    const cv = r.weekly_mean > 0 ? (r.weekly_stdev / r.weekly_mean) * 100 : 0;

    return {
      offer_code: r.offer_code,
      offer_name: r.offer_name ?? r.offer_code,
      category: r.category_title,
      units_sold: r.units_sold,
      orders: r.orders,
      revenue: r.revenue,
      avg_price: r.avg_price,
      first_sale: r.first_sale,
      last_sale: r.last_sale,
      weeks_active: r.weeks_active,
      weekly_mean: r.weekly_mean,
      weekly_stdev: r.weekly_stdev,
      cv,
      abc,
      xyz,
      revenue_share_pct: share,
      cumulative_share_pct: cumulative,
    };
  });

  return result;
}

export interface AbcXyzMatrixCell {
  abc: ABC;
  xyz: XYZ;
  sku_count: number;
  revenue: number;
  units: number;
}

export interface AbcXyzSummary {
  total_sku: number;
  total_revenue: number;
  total_units: number;
  matrix: AbcXyzMatrixCell[]; // 9 cells
  abc_totals: { abc: ABC; sku_count: number; revenue: number; share_pct: number }[];
  xyz_totals: { xyz: XYZ; sku_count: number; revenue: number; share_pct: number }[];
  top_categories: { category: string; sku_count: number; revenue: number }[];
}

export function summariseAbcXyz(rows: SkuAnalysisRow[]): AbcXyzSummary {
  const matrix: Record<string, AbcXyzMatrixCell> = {};
  for (const a of ["A", "B", "C"] as ABC[]) {
    for (const x of ["X", "Y", "Z"] as XYZ[]) {
      matrix[`${a}${x}`] = { abc: a, xyz: x, sku_count: 0, revenue: 0, units: 0 };
    }
  }

  const abcAgg: Record<ABC, { sku_count: number; revenue: number }> = {
    A: { sku_count: 0, revenue: 0 },
    B: { sku_count: 0, revenue: 0 },
    C: { sku_count: 0, revenue: 0 },
  };
  const xyzAgg: Record<XYZ, { sku_count: number; revenue: number }> = {
    X: { sku_count: 0, revenue: 0 },
    Y: { sku_count: 0, revenue: 0 },
    Z: { sku_count: 0, revenue: 0 },
  };
  const catAgg = new Map<string, { sku_count: number; revenue: number }>();

  let totalRev = 0;
  let totalUnits = 0;
  for (const r of rows) {
    const cell = matrix[`${r.abc}${r.xyz}`];
    cell.sku_count++;
    cell.revenue += r.revenue;
    cell.units += r.units_sold;

    abcAgg[r.abc].sku_count++;
    abcAgg[r.abc].revenue += r.revenue;
    xyzAgg[r.xyz].sku_count++;
    xyzAgg[r.xyz].revenue += r.revenue;
    totalRev += r.revenue;
    totalUnits += r.units_sold;

    const cat = r.category ?? "(без категории)";
    const c = catAgg.get(cat) ?? { sku_count: 0, revenue: 0 };
    c.sku_count++;
    c.revenue += r.revenue;
    catAgg.set(cat, c);
  }

  return {
    total_sku: rows.length,
    total_revenue: totalRev,
    total_units: totalUnits,
    matrix: Object.values(matrix),
    abc_totals: (["A", "B", "C"] as ABC[]).map((abc) => ({
      abc,
      sku_count: abcAgg[abc].sku_count,
      revenue: abcAgg[abc].revenue,
      share_pct: totalRev > 0 ? (abcAgg[abc].revenue / totalRev) * 100 : 0,
    })),
    xyz_totals: (["X", "Y", "Z"] as XYZ[]).map((xyz) => ({
      xyz,
      sku_count: xyzAgg[xyz].sku_count,
      revenue: xyzAgg[xyz].revenue,
      share_pct: totalRev > 0 ? (xyzAgg[xyz].revenue / totalRev) * 100 : 0,
    })),
    top_categories: Array.from(catAgg.entries())
      .map(([category, c]) => ({ category, sku_count: c.sku_count, revenue: c.revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10),
  };
}
