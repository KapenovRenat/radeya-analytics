import { NextRequest, NextResponse } from "next/server";
import {
  deliveryAvgCost,
  deliveryByCity,
  deliveryByOblast,
  deliveryCostByPeriod,
  deliveryExpressSplit,
} from "@/lib/kaspi/aggregates";
import { parseRange } from "@/lib/kaspi/analytics-helpers";

export async function GET(req: NextRequest, ctx: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await ctx.params;
  const r = parseRange(req, storeId);
  try {
    const [avgCost, costSeries, expressSplit, cities, oblasts] = await Promise.all([
      deliveryAvgCost(r),
      deliveryCostByPeriod(r, r.period),
      deliveryExpressSplit(r),
      deliveryByCity(r, 20),
      deliveryByOblast(r),
    ]);
    return NextResponse.json({
      from: r.from.toISOString(),
      to: r.to.toISOString(),
      period: r.period,
      avgCost,
      costSeries,
      expressSplit,
      cities,
      oblasts,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
