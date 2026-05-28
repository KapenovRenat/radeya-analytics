import { NextRequest, NextResponse } from "next/server";
import { skuAbcXyzAnalysis, summariseAbcXyz } from "@/lib/kaspi/abc-xyz";
import { parseRange } from "@/lib/kaspi/analytics-helpers";

export async function GET(req: NextRequest, ctx: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await ctx.params;
  const r = parseRange(req, storeId);
  try {
    const rows = await skuAbcXyzAnalysis(r);
    const summary = summariseAbcXyz(rows);
    return NextResponse.json({
      from: r.from.toISOString(),
      to: r.to.toISOString(),
      summary,
      // Keep top N SKUs in the response to control payload size; full list downloadable on demand
      skus: rows.slice(0, 500),
      truncated: rows.length > 500,
      total_skus: rows.length,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
