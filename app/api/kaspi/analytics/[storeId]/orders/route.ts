import { NextRequest, NextResponse } from "next/server";
import {
  cancellationRateByPeriod,
  ordersByDayOfWeek,
  ordersByHour,
  ordersByStatus,
  returnRateByPeriod,
} from "@/lib/kaspi/aggregates";
import { parseRange } from "@/lib/kaspi/analytics-helpers";

export async function GET(req: NextRequest, ctx: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await ctx.params;
  const r = parseRange(req, storeId);
  try {
    const [byStatus, cancelSeries, returnSeries, byDow, byHour] = await Promise.all([
      ordersByStatus(r),
      cancellationRateByPeriod(r, r.period),
      returnRateByPeriod(r, r.period),
      ordersByDayOfWeek(r),
      ordersByHour(r),
    ]);
    return NextResponse.json({
      from: r.from.toISOString(),
      to: r.to.toISOString(),
      period: r.period,
      byStatus,
      cancelSeries,
      returnSeries,
      byDow,
      byHour,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
