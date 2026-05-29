/**
 * DELETE /api/kaspi/ad/[storeId]/reset
 *
 * Wipes advertising data for the store.
 * Query params:
 *   target = "all"    → delete campaigns (cascades to all stats + products)
 *   target = "stats"  → delete only weekly stats + product stats (keeps campaigns/products)
 *   target = "week"   → delete one week's stats (weekStart param required)
 *                       weekStart = ISO date string (e.g. 2026-05-18T00:00:00.000Z)
 */

import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { adCampaigns, adWeeklyStats, adProductStats, adPeriods } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ storeId: string }> },
) {
  const { storeId } = await params;
  const { searchParams } = new URL(req.url);
  const target = searchParams.get("target") ?? "all";

  const db = getDb();

  if (target === "all") {
    // Cascade: adCampaigns → adWeeklyStats, adProducts → adProductStats
    await db.delete(adCampaigns).where(eq(adCampaigns.storeId, storeId));
    // Also remove manual period placeholders
    await db.delete(adPeriods).where(eq(adPeriods.storeId, storeId));
  } else if (target === "stats") {
    // Keep campaigns + products, wipe only stats rows (keep manual periods)
    await db.delete(adWeeklyStats).where(eq(adWeeklyStats.storeId, storeId));
    await db.delete(adProductStats).where(eq(adProductStats.storeId, storeId));
  } else if (target === "week") {
    const weekStartParam = searchParams.get("weekStart");
    if (!weekStartParam) {
      return NextResponse.json({ error: "weekStart is required for target=week" }, { status: 400 });
    }
    const weekDate = new Date(weekStartParam);
    await db.delete(adWeeklyStats).where(
      and(eq(adWeeklyStats.storeId, storeId), eq(adWeeklyStats.weekStart, weekDate)),
    );
    await db.delete(adProductStats).where(
      and(eq(adProductStats.storeId, storeId), eq(adProductStats.weekStart, weekDate)),
    );
    // Also remove the manual period placeholder for this week (if any)
    await db.delete(adPeriods).where(
      and(eq(adPeriods.storeId, storeId), eq(adPeriods.weekStart, weekDate)),
    );
  }

  return NextResponse.json({ ok: true });
}
