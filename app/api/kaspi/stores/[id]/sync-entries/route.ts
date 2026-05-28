import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { kaspiEntriesSyncState } from "@/lib/db/schema";
import { startEntriesSync, stepEntriesSync } from "@/lib/kaspi/entries-sync";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const action = body?.action as "start" | "step" | undefined;

  try {
    if (action === "start") {
      return NextResponse.json(await startEntriesSync(id));
    }
    const db = getDb();
    const [state] = await db
      .select()
      .from(kaspiEntriesSyncState)
      .where(eq(kaspiEntriesSyncState.storeId, id));
    if (!state || state.status !== "running") {
      return NextResponse.json(await startEntriesSync(id));
    }
    return NextResponse.json(await stepEntriesSync(id));
  } catch (err) {
    return NextResponse.json(
      { status: "failed", error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = getDb();
  const [state] = await db
    .select()
    .from(kaspiEntriesSyncState)
    .where(eq(kaspiEntriesSyncState.storeId, id));
  if (!state) {
    return NextResponse.json({ status: "idle", progress: 0 });
  }
  const total = state.totalOrders ?? 0;
  const done = state.ordersProcessed ?? 0;
  return NextResponse.json({
    status: state.status,
    progress: total > 0 ? done / total : 1,
    ordersProcessed: done,
    totalOrders: total,
    entriesSynced: state.entriesSynced ?? 0,
    error: state.lastError,
  });
}
