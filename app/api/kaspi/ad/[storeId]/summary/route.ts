/**
 * GET /api/kaspi/ad/[storeId]/summary
 *
 * Aggregated ad stats for the summary dashboard.
 * Query params:
 *   from? — ISO date string
 *   to?   — ISO date string
 *
 * Response:
 * {
 *   kpi: { totalSpent, totalOrders, totalRevenue, avgDrr, activeCampaigns },
 *   weekly: { weekStart, weekEnd, spent, orders, revenue, drrPct }[],
 *   topCampaigns: { name, spent, orders, drrPct, rating }[],
 *   ratingDist: { rating, count }[]
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { eq, and, gte, lte, sql, asc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { adCampaigns, adWeeklyStats } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ storeId: string }> },
) {
  const { storeId } = await params;
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const db = getDb();

  const dateFilters: ReturnType<typeof gte>[] = [];
  if (from) dateFilters.push(gte(adWeeklyStats.weekStart, new Date(from)));
  if (to) dateFilters.push(lte(adWeeklyStats.weekStart, new Date(to)));

  const statsWhere = and(
    eq(adWeeklyStats.storeId, storeId),
    eq(adWeeklyStats.isMonthlyTotal, false), // weekly only for charts
    ...dateFilters,
  );

  // All weekly stats (non-monthly)
  const stats = await db
    .select()
    .from(adWeeklyStats)
    .where(statsWhere)
    .orderBy(asc(adWeeklyStats.weekStart));

  // Active campaigns count
  const campaignRows = await db
    .select({ id: adCampaigns.id, name: adCampaigns.name, status: adCampaigns.status })
    .from(adCampaigns)
    .where(eq(adCampaigns.storeId, storeId));

  const activeCampaigns = campaignRows.filter((c) => c.status === "on").length;

  // Aggregate by week
  const weekMap = new Map<string, {
    weekStart: string;
    weekEnd: string;
    spent: number;
    orders: number;
    revenue: number;
    drrNumerator: number;
    drrCount: number;
  }>();

  for (const s of stats) {
    const key = s.weekStart.toISOString();
    if (!weekMap.has(key)) {
      weekMap.set(key, {
        weekStart: s.weekStart.toISOString(),
        weekEnd: s.weekEnd.toISOString(),
        spent: 0, orders: 0, revenue: 0, drrNumerator: 0, drrCount: 0,
      });
    }
    const w = weekMap.get(key)!;
    w.spent += s.spent ?? 0;
    w.orders += s.orders ?? 0;
    w.revenue += s.revenue ?? 0;
    if (s.drrPct != null && s.drrPct > 0) {
      w.drrNumerator += s.drrPct;
      w.drrCount += 1;
    }
  }

  const weekly = Array.from(weekMap.values()).map((w) => ({
    weekStart: w.weekStart,
    weekEnd: w.weekEnd,
    spent: Math.round(w.spent),
    orders: w.orders,
    revenue: Math.round(w.revenue),
    drrPct: w.drrCount > 0 ? parseFloat((w.drrNumerator / w.drrCount).toFixed(1)) : null,
  }));

  // KPI totals
  const totalSpent = weekly.reduce((s, w) => s + w.spent, 0);
  const totalOrders = weekly.reduce((s, w) => s + w.orders, 0);
  const totalRevenue = weekly.reduce((s, w) => s + w.revenue, 0);
  const drrWeeks = weekly.filter((w) => w.drrPct != null);
  const avgDrr = drrWeeks.length > 0
    ? parseFloat((drrWeeks.reduce((s, w) => s + (w.drrPct ?? 0), 0) / drrWeeks.length).toFixed(1))
    : null;

  // Top campaigns by spend (aggregate across weeks)
  const campaignAgg = new Map<string, { name: string; spent: number; orders: number; drrSum: number; drrCount: number; rating: string }>();
  const campaignNameMap = new Map(campaignRows.map((c) => [c.id, c.name]));

  for (const s of stats) {
    if (!campaignAgg.has(s.campaignId)) {
      campaignAgg.set(s.campaignId, {
        name: campaignNameMap.get(s.campaignId) ?? "—",
        spent: 0, orders: 0, drrSum: 0, drrCount: 0, rating: "no_data",
      });
    }
    const c = campaignAgg.get(s.campaignId)!;
    c.spent += s.spent ?? 0;
    c.orders += s.orders ?? 0;
    if (s.drrPct != null && s.drrPct > 0) { c.drrSum += s.drrPct; c.drrCount++; }
    // Use latest rating
    if (s.rating && s.rating !== "no_data") c.rating = s.rating;
  }

  const topCampaigns = Array.from(campaignAgg.values())
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 10)
    .map((c) => ({
      name: c.name,
      spent: Math.round(c.spent),
      orders: c.orders,
      drrPct: c.drrCount > 0 ? parseFloat((c.drrSum / c.drrCount).toFixed(1)) : null,
      rating: c.rating,
    }));

  // Rating distribution
  const ratingCounts = new Map<string, number>([
    ["good", 0], ["normal", 0], ["bad", 0], ["no_data", 0],
  ]);
  for (const s of stats) {
    const r = s.rating ?? "no_data";
    ratingCounts.set(r, (ratingCounts.get(r) ?? 0) + 1);
  }
  const ratingDist = Array.from(ratingCounts.entries())
    .filter(([, count]) => count > 0)
    .map(([rating, count]) => ({ rating, count }));

  return NextResponse.json({
    kpi: { totalSpent, totalOrders, totalRevenue, avgDrr, activeCampaigns },
    weekly,
    topCampaigns,
    ratingDist,
  });
}
