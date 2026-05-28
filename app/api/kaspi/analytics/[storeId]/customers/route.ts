import { NextRequest, NextResponse } from "next/server";
import {
  customerOrdersDistribution,
  customerRepeatCount,
  newVsReturningByPeriod,
  topCustomers,
} from "@/lib/kaspi/aggregates";
import { parseRange } from "@/lib/kaspi/analytics-helpers";

export async function GET(req: NextRequest, ctx: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await ctx.params;
  const r = parseRange(req, storeId);
  try {
    const [repeats, top, newReturning, distribution] = await Promise.all([
      customerRepeatCount(r),
      topCustomers(r, 20),
      newVsReturningByPeriod(r, r.period),
      customerOrdersDistribution(r),
    ]);
    return NextResponse.json({
      from: r.from.toISOString(),
      to: r.to.toISOString(),
      period: r.period,
      repeats,
      top,
      newReturning,
      distribution,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
