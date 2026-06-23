/**
 * GET /api/kaspi/stores/[id]/sync-history
 *
 * Returns the sync history for a store, newest first (last 50 rows).
 */

import { NextRequest, NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { kaspiSyncHistory } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = getDb();

  const rows = await db
    .select()
    .from(kaspiSyncHistory)
    .where(eq(kaspiSyncHistory.storeId, id))
    .orderBy(desc(kaspiSyncHistory.finishedAt))
    .limit(50);

  return NextResponse.json({ history: rows });
}
