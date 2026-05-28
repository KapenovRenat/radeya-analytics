import { NextRequest, NextResponse } from "next/server";
import {
  avgOrderValueByPeriod,
  revenueByDeliveryMode,
  revenueByPaymentMode,
  revenueByPeriod,
} from "@/lib/kaspi/aggregates";
import { parseRange } from "@/lib/kaspi/analytics-helpers";

export async function GET(req: NextRequest, ctx: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await ctx.params;
  const r = parseRange(req, storeId);
  try {
    const [series, byPayment, byDelivery, avgSeries] = await Promise.all([
      revenueByPeriod(r, r.period),
      revenueByPaymentMode(r),
      revenueByDeliveryMode(r),
      avgOrderValueByPeriod(r, r.period),
    ]);
    return NextResponse.json({
      from: r.from.toISOString(),
      to: r.to.toISOString(),
      period: r.period,
      series,
      byPayment,
      byDelivery,
      avgSeries,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
