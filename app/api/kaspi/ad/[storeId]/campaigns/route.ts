/**
 * GET /api/kaspi/ad/[storeId]/campaigns
 *
 * Returns all campaigns for the store with their weekly stats.
 * Query params:
 *   from? — ISO date string (filter weekStart >= from)
 *   to?   — ISO date string (filter weekEnd <= to)
 *
 * Response:
 * {
 *   campaigns: CampaignWithStats[],
 *   periods: Period[]   // all unique week periods sorted asc
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { eq, and, gte, lte, asc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { adCampaigns, adWeeklyStats, adProducts } from "@/lib/db/schema";

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

  // Build date filter for weekly stats.
  // We filter by weekStart only — more robust than filtering weekEnd
  // (avoids edge cases with T00:00:00Z vs T23:59:59Z stored weekEnds).
  const dateFilters = [];
  if (from) dateFilters.push(gte(adWeeklyStats.weekStart, new Date(from)));
  if (to) dateFilters.push(lte(adWeeklyStats.weekStart, new Date(to)));

  // Fetch all campaigns for store
  const campaigns = await db
    .select()
    .from(adCampaigns)
    .where(eq(adCampaigns.storeId, storeId))
    .orderBy(asc(adCampaigns.name));

  // Fetch all weekly stats for store (filtered by date)
  const statsWhere = dateFilters.length
    ? and(eq(adWeeklyStats.storeId, storeId), ...dateFilters)
    : eq(adWeeklyStats.storeId, storeId);

  const stats = await db
    .select()
    .from(adWeeklyStats)
    .where(statsWhere)
    .orderBy(asc(adWeeklyStats.weekStart));

  // Group stats by campaignId
  const statsByCampaign = new Map<string, typeof stats>();
  for (const s of stats) {
    if (!statsByCampaign.has(s.campaignId)) {
      statsByCampaign.set(s.campaignId, []);
    }
    statsByCampaign.get(s.campaignId)!.push(s);
  }

  // Collect all unique periods (non-monthly first, then monthly)
  const periodsMap = new Map<string, { weekStart: Date; weekEnd: Date; isMonthlyTotal: boolean }>();
  for (const s of stats) {
    const key = `${s.weekStart.toISOString()}_${s.isMonthlyTotal}`;
    if (!periodsMap.has(key)) {
      periodsMap.set(key, {
        weekStart: s.weekStart,
        weekEnd: s.weekEnd,
        isMonthlyTotal: s.isMonthlyTotal ?? false,
      });
    }
  }
  const periods = Array.from(periodsMap.values()).sort((a, b) => {
    // weekly before monthly, then by date
    if (a.isMonthlyTotal !== b.isMonthlyTotal) return a.isMonthlyTotal ? 1 : -1;
    return a.weekStart.getTime() - b.weekStart.getTime();
  });

  const result = campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    improveCard: c.improveCard,
    hasReviews: c.hasReviews,
    hasDiscount: c.hasDiscount,
    inStock: c.inStock,
    hasVideo: c.hasVideo,
    createdAt: c.createdAt,
    weeks: (statsByCampaign.get(c.id) ?? []).map((s) => ({
      id: s.id,
      weekStart: s.weekStart,
      weekEnd: s.weekEnd,
      isMonthlyTotal: s.isMonthlyTotal,
      spent: s.spent,
      dailyBudget: s.dailyBudget,
      targetClick: s.targetClick,
      avgClick: s.avgClick,
      orders: s.orders,
      revenue: s.revenue,
      drrPct: s.drrPct,
      ctrPct: s.ctrPct,
      convCartPct: s.convCartPct,
      convFavPct: s.convFavPct,
      rating: s.rating,
    })),
  }));

  return NextResponse.json({ campaigns: result, periods });
}

// PATCH /api/kaspi/ad/[storeId]/campaigns — inline edit
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ storeId: string }> },
) {
  const { storeId } = await params;
  const body = await req.json();
  const { type, id, field, value } = body as {
    type: "campaign" | "stat";
    id: string;
    field: string;
    value: unknown;
  };

  const db = getDb();

  if (type === "campaign") {
    const allowed = ["status", "improveCard", "hasReviews", "hasDiscount", "inStock", "hasVideo"];
    if (!allowed.includes(field)) {
      return NextResponse.json({ error: "Field not editable" }, { status: 400 });
    }
    await db
      .update(adCampaigns)
      .set({ [field]: value, updatedAt: new Date() } as never)
      .where(and(eq(adCampaigns.id, id), eq(adCampaigns.storeId, storeId)));

    // При смене статуса кампании — синхронизируем статус всех её товаров
    if (field === "status") {
      const productStatus = value === "on" ? "active" : "inactive";
      await db
        .update(adProducts)
        .set({ status: productStatus, updatedAt: new Date() })
        .where(and(eq(adProducts.campaignId, id), eq(adProducts.storeId, storeId)));
    }
  } else if (type === "stat") {
    const allowed = ["dailyBudget", "targetClick", "orders", "revenue", "drrPct", "ctrPct", "convCartPct", "convFavPct", "rating"];
    if (!allowed.includes(field)) {
      return NextResponse.json({ error: "Field not editable" }, { status: 400 });
    }
    await db
      .update(adWeeklyStats)
      .set({ [field]: value, updatedAt: new Date() } as never)
      .where(eq(adWeeklyStats.id, id));
  }

  return NextResponse.json({ ok: true });
}
