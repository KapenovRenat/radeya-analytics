/**
 * Kaspi Advertising — ingestion layer.
 *
 * Abstracted from the data source: same functions work whether data
 * comes from CSV upload or (future) Kaspi Marketing API.
 *
 * All writes use upsert — safe to re-upload the same file.
 */

import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  adCampaigns,
  adWeeklyStats,
  adProducts,
  adProductStats,
} from "@/lib/db/schema";
import type { ParsedCampaignRow, ParsedProductRow } from "./csv-parser";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IngestCampaignsResult {
  upserted: number;
  campaignIds: Record<string, string>; // name → id
}

export interface IngestProductsResult {
  upserted: number;
}

// ─── Campaigns ────────────────────────────────────────────────────────────────

/**
 * Upsert campaigns + their weekly stats for one period.
 * Creates campaign row if not exists, then upserts weekly stats.
 */
export async function ingestCampaigns(
  storeId: string,
  rows: ParsedCampaignRow[],
  weekStart: Date,
  weekEnd: Date,
  isMonthlyTotal = false,
): Promise<IngestCampaignsResult> {
  const db = getDb();
  const campaignIds: Record<string, string> = {};
  let upserted = 0;

  for (const row of rows) {
    // 1. Upsert campaign (справочник)
    const existing = await db
      .select({ id: adCampaigns.id })
      .from(adCampaigns)
      .where(and(eq(adCampaigns.storeId, storeId), eq(adCampaigns.name, row.name)))
      .limit(1);

    let campaignId: string;

    if (existing.length > 0) {
      campaignId = existing[0].id;
      // Update status in case it changed
      await db
        .update(adCampaigns)
        .set({ status: row.status, updatedAt: new Date() })
        .where(eq(adCampaigns.id, campaignId));
    } else {
      const inserted = await db
        .insert(adCampaigns)
        .values({ storeId, name: row.name, status: row.status })
        .returning({ id: adCampaigns.id });
      campaignId = inserted[0].id;
    }

    campaignIds[row.name] = campaignId;

    // 2. Upsert weekly stats
    await db
      .insert(adWeeklyStats)
      .values({
        campaignId,
        storeId,
        weekStart,
        weekEnd,
        isMonthlyTotal,
        impressions: row.impressions,
        spent: row.spent,
        dailyBudget: 0, // filled manually by user
        avgClick: row.avgClick,
        orders: row.orders,
        revenue: row.revenue,
        drrPct: row.drrPct ?? 0,
        ctrPct: row.ctrPct,
        convCartPct: row.convCartPct,
        convFavPct: row.convFavPct,
        rating: row.rating,
      })
      .onConflictDoUpdate({
        target: [adWeeklyStats.campaignId, adWeeklyStats.weekStart, adWeeklyStats.isMonthlyTotal],
        set: {
          impressions: row.impressions,
          spent: row.spent,
          avgClick: row.avgClick,
          orders: row.orders,
          revenue: row.revenue,
          drrPct: row.drrPct ?? 0,
          ctrPct: row.ctrPct,
          convCartPct: row.convCartPct,
          convFavPct: row.convFavPct,
          rating: row.rating,
          updatedAt: new Date(),
        },
      });

    upserted++;
  }

  return { upserted, campaignIds };
}

// ─── Products ─────────────────────────────────────────────────────────────────

/**
 * Upsert products + their weekly stats for one campaign + period.
 * campaignId must already exist in ad_campaigns.
 */
export async function ingestProducts(
  storeId: string,
  campaignId: string,
  rows: ParsedProductRow[],
  weekStart: Date,
  weekEnd: Date,
): Promise<IngestProductsResult> {
  const db = getDb();
  let upserted = 0;

  for (const row of rows) {
    // 1. Upsert product (справочник)
    const existing = await db
      .select({ id: adProducts.id })
      .from(adProducts)
      .where(and(eq(adProducts.campaignId, campaignId), eq(adProducts.name, row.name)))
      .limit(1);

    let productId: string;

    if (existing.length > 0) {
      productId = existing[0].id;
      await db
        .update(adProducts)
        .set({ status: row.status, category: row.category, updatedAt: new Date() })
        .where(eq(adProducts.id, productId));
    } else {
      const inserted = await db
        .insert(adProducts)
        .values({
          campaignId,
          storeId,
          name: row.name,
          category: row.category,
          status: row.status,
        })
        .returning({ id: adProducts.id });
      productId = inserted[0].id;
    }

    // 2. Upsert weekly stats
    await db
      .insert(adProductStats)
      .values({
        productId,
        campaignId,
        storeId,
        weekStart,
        weekEnd,
        impressions: row.impressions,
        spent: row.spent,
        avgClick: row.avgClick,
        orders: row.orders,
        revenue: row.revenue,
        drrPct: row.drrPct ?? 0,
        ctrPct: row.ctrPct,
        convCartPct: row.convCartPct,
        convFavPct: row.convFavPct,
        rating: row.rating,
      })
      .onConflictDoUpdate({
        target: [adProductStats.productId, adProductStats.weekStart],
        set: {
          impressions: row.impressions,
          spent: row.spent,
          avgClick: row.avgClick,
          orders: row.orders,
          revenue: row.revenue,
          drrPct: row.drrPct ?? 0,
          ctrPct: row.ctrPct,
          convCartPct: row.convCartPct,
          convFavPct: row.convFavPct,
          rating: row.rating,
          updatedAt: new Date(),
        },
      });

    upserted++;
  }

  return { upserted };
}
