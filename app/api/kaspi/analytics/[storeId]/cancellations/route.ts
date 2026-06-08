import { NextRequest, NextResponse } from "next/server";
import {
  cancelledInTransitSummary,
  cancelledInTransitProducts,
  cancelledInTransitByReason,
} from "@/lib/kaspi/aggregates";
import { parseRange } from "@/lib/kaspi/analytics-helpers";

export async function GET(req: NextRequest, ctx: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await ctx.params;
  const r = parseRange(req, storeId);
  try {
    const [summary, products, byReason] = await Promise.all([
      cancelledInTransitSummary(r),
      cancelledInTransitProducts(r),
      cancelledInTransitByReason(r),
    ]);
    return NextResponse.json({
      from: r.from.toISOString(),
      to: r.to.toISOString(),
      summary,
      products,
      byReason,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
