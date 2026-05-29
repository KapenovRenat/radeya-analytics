/**
 * GET /api/kaspi/ad/[storeId]/products
 *
 * Returns products with weekly stats.
 * Query params:
 *   campaignId? — filter by campaign (omit = all campaigns)
 *   weeks[]?    — ISO weekStart strings (multi-select filter)
 *   from?       — ISO date string (weekStart >=, fallback)
 *   to?         — ISO date string (weekStart <=, fallback)
 *
 * Response:
 * {
 *   campaigns: { id, name }[],
 *   products: ProductWithStats[],
 *   periods: Period[]
 * }
 *
 * PATCH /api/kaspi/ad/[storeId]/products — inline edit product fields
 */

import { NextRequest, NextResponse } from "next/server";
import { eq, and, gte, lte, asc, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { adCampaigns, adProducts, adProductStats } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ storeId: string }> },
) {
  const { storeId } = await params;
  const { searchParams } = new URL(req.url);
  const campaignId = searchParams.get("campaignId");
  const weeksParam = searchParams.getAll("weeks");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const db = getDb();

  // All campaigns for dropdown
  const campaigns = await db
    .select({ id: adCampaigns.id, name: adCampaigns.name })
    .from(adCampaigns)
    .where(eq(adCampaigns.storeId, storeId))
    .orderBy(asc(adCampaigns.name));

  // Products filter
  const productFilters = [eq(adProducts.storeId, storeId)];
  if (campaignId) productFilters.push(eq(adProducts.campaignId, campaignId));

  const products = await db
    .select()
    .from(adProducts)
    .where(and(...productFilters))
    .orderBy(asc(adProducts.category), asc(adProducts.name));

  if (!products.length) {
    return NextResponse.json({ campaigns, products: [], periods: [] });
  }

  // Product stats filter
  const statsFilters = [eq(adProductStats.storeId, storeId)];
  if (campaignId) statsFilters.push(eq(adProductStats.campaignId, campaignId));
  if (weeksParam.length > 0) {
    statsFilters.push(inArray(adProductStats.weekStart, weeksParam.map((w) => new Date(w))) as never);
  } else {
    if (from) statsFilters.push(gte(adProductStats.weekStart, new Date(from)));
    if (to) statsFilters.push(lte(adProductStats.weekStart, new Date(to)));
  }

  const stats = await db
    .select()
    .from(adProductStats)
    .where(and(...statsFilters))
    .orderBy(asc(adProductStats.weekStart));

  // Group stats by productId
  const statsByProduct = new Map<string, typeof stats>();
  for (const s of stats) {
    if (!statsByProduct.has(s.productId)) {
      statsByProduct.set(s.productId, []);
    }
    statsByProduct.get(s.productId)!.push(s);
  }

  // Collect unique periods (include granularity)
  const periodsMap = new Map<string, { weekStart: Date; weekEnd: Date; granularity: string }>();
  for (const s of stats) {
    const key = s.weekStart.toISOString();
    if (!periodsMap.has(key)) {
      periodsMap.set(key, { weekStart: s.weekStart, weekEnd: s.weekEnd, granularity: s.granularity ?? "week" });
    }
  }
  const periods = Array.from(periodsMap.values()).sort(
    (a, b) => a.weekStart.getTime() - b.weekStart.getTime(),
  );

  // Build campaign name map
  const campaignMap = new Map(campaigns.map((c) => [c.id, c.name]));

  const result = products.map((p) => ({
    id: p.id,
    campaignId: p.campaignId,
    campaignName: campaignMap.get(p.campaignId) ?? "—",
    name: p.name,
    category: p.category ?? "Другое",
    status: p.status,
    improveCard: p.improveCard,
    hasReviews: p.hasReviews,
    hasDiscount: p.hasDiscount,
    inStock: p.inStock,
    hasVideo: p.hasVideo,
    weeks: (statsByProduct.get(p.id) ?? []).map((s) => ({
      id: s.id,
      weekStart: s.weekStart,
      weekEnd: s.weekEnd,
      impressions: s.impressions,
      spent: s.spent,
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

  return NextResponse.json({ campaigns, products: result, periods });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ storeId: string }> },
) {
  const { storeId } = await params;
  const body = await req.json();
  const { type, id, field, value } = body as {
    type: "product" | "stat";
    id: string;
    field: string;
    value: unknown;
  };

  const db = getDb();

  if (type === "product") {
    const allowed = ["status", "improveCard", "hasReviews", "hasDiscount", "inStock", "hasVideo"];
    if (!allowed.includes(field)) {
      return NextResponse.json({ error: "Field not editable" }, { status: 400 });
    }
    await db
      .update(adProducts)
      .set({ [field]: value, updatedAt: new Date() } as never)
      .where(and(eq(adProducts.id, id), eq(adProducts.storeId, storeId)));
  } else if (type === "stat") {
    const allowed = ["targetClick", "orders", "drrPct", "ctrPct", "convCartPct", "convFavPct", "rating"];
    if (!allowed.includes(field)) {
      return NextResponse.json({ error: "Field not editable" }, { status: 400 });
    }
    await db
      .update(adProductStats)
      .set({ [field]: value, updatedAt: new Date() } as never)
      .where(eq(adProductStats.id, id));
  }

  return NextResponse.json({ ok: true });
}
