/**
 * GET  /api/kaspi/ad/[storeId]/overview?from=ISO&to=ISO
 *   Returns daily rows for the date range. If no range → all rows.
 *   Response: { rows: DailyRow[], weeks: WeekSummary[] }
 *
 * POST /api/kaspi/ad/[storeId]/overview
 *   Accepts multipart/form-data with file: «Обзорный отчёт» CSV.
 *   Upserts daily rows. Returns { upserted: number, from, to }.
 *
 * DELETE /api/kaspi/ad/[storeId]/overview?from=ISO&to=ISO
 *   Deletes rows in the date range.
 */

import { NextRequest, NextResponse } from "next/server";
import { eq, and, gte, lte, asc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { adStoreOverview } from "@/lib/db/schema";
import { parseOverviewCsv } from "@/lib/ad/csv-parser";

export const dynamic = "force-dynamic";

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ storeId: string }> },
) {
  const { storeId } = await params;
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to   = searchParams.get("to");

  const db = getDb();
  const filters = [eq(adStoreOverview.storeId, storeId)];
  if (from) filters.push(gte(adStoreOverview.date, new Date(from)));
  if (to)   filters.push(lte(adStoreOverview.date, new Date(to)));

  const rows = await db
    .select()
    .from(adStoreOverview)
    .where(and(...filters))
    .orderBy(asc(adStoreOverview.date));

  return NextResponse.json({ rows });
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ storeId: string }> },
) {
  const { storeId } = await params;
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
  }

  const content = await file.text();
  const parsed = parseOverviewCsv(content);

  if (parsed.length === 0) {
    return NextResponse.json({ error: "Файл пустой или неверный формат" }, { status: 400 });
  }

  const db = getDb();
  let upserted = 0;

  for (const row of parsed) {
    await db
      .insert(adStoreOverview)
      .values({
        storeId,
        date: row.date,
        impressions: row.impressions,
        clicks:      row.clicks,
        ctrPct:      row.ctrPct,
        avgClick:    row.avgClick,
        spent:       row.spent,
        revenue:     row.revenue,
        orders:      row.orders,
        favorites:   row.favorites,
        cart:        row.cart,
        drrPct:      row.drrPct,
      })
      .onConflictDoUpdate({
        target: [adStoreOverview.storeId, adStoreOverview.date],
        set: {
          impressions: row.impressions,
          clicks:      row.clicks,
          ctrPct:      row.ctrPct,
          avgClick:    row.avgClick,
          spent:       row.spent,
          revenue:     row.revenue,
          orders:      row.orders,
          favorites:   row.favorites,
          cart:        row.cart,
          drrPct:      row.drrPct,
        },
      });
    upserted++;
  }

  const from = parsed[0].date.toISOString().slice(0, 10);
  const to   = parsed[parsed.length - 1].date.toISOString().slice(0, 10);

  return NextResponse.json({ upserted, from, to });
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ storeId: string }> },
) {
  const { storeId } = await params;
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to   = searchParams.get("to");

  const db = getDb();
  const filters = [eq(adStoreOverview.storeId, storeId)];
  if (from) filters.push(gte(adStoreOverview.date, new Date(from)));
  if (to)   filters.push(lte(adStoreOverview.date, new Date(to)));

  await db.delete(adStoreOverview).where(and(...filters));
  return NextResponse.json({ ok: true });
}
