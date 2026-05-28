import { NextRequest, NextResponse } from "next/server";
import { creditByTerm, creditSplit } from "@/lib/kaspi/aggregates";
import { parseRange } from "@/lib/kaspi/analytics-helpers";

export async function GET(req: NextRequest, ctx: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await ctx.params;
  const r = parseRange(req, storeId);
  try {
    const [split, byTerm] = await Promise.all([creditSplit(r), creditByTerm(r)]);
    return NextResponse.json({
      from: r.from.toISOString(),
      to: r.to.toISOString(),
      period: r.period,
      split,
      byTerm,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
