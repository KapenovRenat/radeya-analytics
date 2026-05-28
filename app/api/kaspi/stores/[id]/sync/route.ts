import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { kaspiSyncState } from "@/lib/db/schema";
import { startSync, stepSync } from "@/lib/kaspi/sync";

/**
 * POST /api/kaspi/stores/[id]/sync — chunk-by-chunk.
 *
 * Body (optional): { action: "start" | "step", from?: ISO, to?: ISO }
 * Default: start new sync if none running, otherwise process next chunk.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const action = body?.action as "start" | "step" | undefined;

  try {
    if (action === "start") {
      const from = body?.from ? new Date(body.from) : undefined;
      const to = body?.to ? new Date(body.to) : undefined;
      const result = await startSync(id, { from, to, force: body?.force === true });
      return NextResponse.json(result);
    }

    // default: step (if no state, auto-start)
    const db = getDb();
    const [state] = await db.select().from(kaspiSyncState).where(eq(kaspiSyncState.storeId, id));
    if (!state) {
      const result = await startSync(id);
      return NextResponse.json(result);
    }
    if (state.status !== "running") {
      const result = await startSync(id, { force: true });
      return NextResponse.json(result);
    }

    const result = await stepSync(id);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ status: "failed", error: message }, { status: 500 });
  }
}

/**
 * GET /api/kaspi/stores/[id]/sync — current sync state (for polling).
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = getDb();
  const [state] = await db.select().from(kaspiSyncState).where(eq(kaspiSyncState.storeId, id));
  if (!state) return NextResponse.json({ status: "idle", progress: 0 });

  const total = state.totalChunks ?? 0;
  const done = state.chunksDone ?? 0;
  return NextResponse.json({
    status: state.status,
    progress: total > 0 ? done / total : 0,
    chunksDone: done,
    totalChunks: total,
    ordersSynced: state.ordersSynced ?? 0,
    error: state.lastError,
    currentRange:
      state.currentChunkStart && state.currentChunkEnd
        ? { from: state.currentChunkStart, to: state.currentChunkEnd }
        : undefined,
  });
}
