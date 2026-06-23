import { NextRequest, NextResponse } from "next/server";
import {
  dashboardKpis,
  periodComparison,
  revenueByPeriod,
  topDays,
} from "@/lib/kaspi/aggregates";
import { parseRange } from "@/lib/kaspi/analytics-helpers";

export async function GET(req: NextRequest, ctx: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await ctx.params;
  const r = parseRange(req, storeId);
  try {
    const [kpis, compare, series, top] = await Promise.all([
      dashboardKpis(r),
      periodComparison(r),
      revenueByPeriod(r, r.period, true), // gross: график дашборда = все заказы
      topDays(r, 10),
    ]);
    return NextResponse.json({
      from: r.from.toISOString(),
      to: r.to.toISOString(),
      period: r.period,
      kpis,
      compare,
      series,
      topDays: top,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
