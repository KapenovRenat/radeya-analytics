/**
 * GET /api/kaspi/ad/[storeId]/weeks
 *
 * Returns all distinct period options for the store, sorted desc.
 * Merges:
 *   1. Real periods from ad_weekly_stats (non-monthly, distinct weekStart+weekEnd+granularity)
 *   2. Manually created placeholders from ad_periods (before data upload)
 *
 * Response:
 * {
 *   weeks: { weekStart: string, weekEnd: string, granularity: string }[]
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { adWeeklyStats, adPeriods } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ storeId: string }> },
) {
  const { storeId } = await params;
  const db = getDb();

  // 1. Real periods from uploaded stats (non-monthly only)
  const statRows = await db
    .selectDistinct({
      weekStart: adWeeklyStats.weekStart,
      weekEnd: adWeeklyStats.weekEnd,
      granularity: adWeeklyStats.granularity,
    })
    .from(adWeeklyStats)
    .where(and(eq(adWeeklyStats.storeId, storeId), eq(adWeeklyStats.isMonthlyTotal, false)));

  // 2. Manually created placeholder periods
  const periodRows = await db
    .select({
      weekStart: adPeriods.weekStart,
      weekEnd: adPeriods.weekEnd,
      granularity: adPeriods.granularity,
    })
    .from(adPeriods)
    .where(eq(adPeriods.storeId, storeId));

  // Merge: deduplicate by weekStart+weekEnd (a daily entry and a weekly placeholder
  // can share the same weekStart but differ in weekEnd — keep both).
  // Real data takes precedence over manual placeholders for identical start+end.
  const seen = new Map<string, { weekStart: string; weekEnd: string; granularity: string }>();

  const rowKey = (start: Date, end: Date) =>
    `${start.toISOString()}__${end.toISOString()}`;

  // Add real data first (priority)
  for (const r of statRows) {
    const key = rowKey(r.weekStart, r.weekEnd);
    if (!seen.has(key)) {
      seen.set(key, {
        weekStart: r.weekStart.toISOString(),
        weekEnd: r.weekEnd.toISOString(),
        granularity: r.granularity ?? "week",
      });
    }
  }

  // Add manual placeholders (only if no identical start+end in real data)
  for (const r of periodRows) {
    const key = rowKey(r.weekStart, r.weekEnd);
    if (!seen.has(key)) {
      seen.set(key, {
        weekStart: r.weekStart.toISOString(),
        weekEnd: r.weekEnd.toISOString(),
        granularity: r.granularity ?? "week",
      });
    }
  }

  // Sort descending by weekStart
  const weeks = Array.from(seen.values()).sort(
    (a, b) => new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime(),
  );

  return NextResponse.json({ weeks });
}
