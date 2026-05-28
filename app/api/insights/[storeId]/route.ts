import { NextRequest, NextResponse } from "next/server";
import { buildStoreContext, generateInsights } from "@/lib/insights/llm";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/insights/[storeId]?from=ISO&to=ISO
 *
 * Pulls a compact aggregate summary of the store for the given window and
 * asks Claude (Opus 4.7, adaptive thinking, effort=high, json_schema output)
 * to produce structured insights. The system prompt is prompt-cached, so
 * repeated requests within the cache TTL pay ~0.1× on the prompt prefix.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ storeId: string }> }) {
  const { storeId } = await ctx.params;
  const sp = req.nextUrl.searchParams;
  const now = new Date();
  const to = sp.get("to") ? new Date(sp.get("to")!) : now;
  const from = sp.get("from") ? new Date(sp.get("from")!) : new Date(now.getTime() - 30 * 86_400_000);

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY env var is required for live insights" },
      { status: 500 },
    );
  }

  try {
    const context = await buildStoreContext(storeId, from, to);
    const result = await generateInsights(context);
    return NextResponse.json({
      from: from.toISOString(),
      to: to.toISOString(),
      context_summary: {
        store_name: context.store.name,
        total_orders: context.kpis.total_orders,
        revenue_kzt: context.kpis.revenue_completed_kzt,
      },
      ...result,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
