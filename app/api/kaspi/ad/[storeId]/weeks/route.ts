/**
 * GET /api/kaspi/ad/[storeId]/weeks
 *
 * Returns all distinct non-monthly week periods for the store, sorted desc.
 * Used by WeekSelector to populate the multi-select dropdown.
 *
 * Response:
 * {
 *   weeks: { weekStart: string, weekEnd: string }[]
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { adWeeklyStats } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ storeId: string }> },
) {
  const { storeId } = await params;
  const db = getDb();

  const rows = await db
    .selectDistinct({ weekStart: adWeeklyStats.weekStart, weekEnd: adWeeklyStats.weekEnd })
    .from(adWeeklyStats)
    .where(and(eq(adWeeklyStats.storeId, storeId), eq(adWeeklyStats.isMonthlyTotal, false)))
    .orderBy(desc(adWeeklyStats.weekStart));

  return NextResponse.json({ weeks: rows });
}
