/**
 * POST /api/kaspi/ad/[storeId]/periods
 *
 * Create a manual period placeholder (before uploading data).
 * Body: { weekStart: string (ISO), weekEnd: string (ISO), granularity?: "week" | "day" }
 *
 * If weekStart === weekEnd, granularity is forced to "day".
 * Upserts — safe to call multiple times for the same period.
 *
 * Response: { ok: true, period: { weekStart, weekEnd, granularity } }
 */

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { adPeriods } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ storeId: string }> },
) {
  const { storeId } = await params;
  const body = await req.json() as {
    weekStart: string;
    weekEnd: string;
    granularity?: "week" | "day";
  };

  const { weekStart: wsRaw, weekEnd: weRaw } = body;
  if (!wsRaw || !weRaw) {
    return NextResponse.json({ error: "weekStart and weekEnd are required" }, { status: 400 });
  }

  const weekStart = new Date(wsRaw);
  const weekEnd = new Date(weRaw);

  if (isNaN(weekStart.getTime()) || isNaN(weekEnd.getTime())) {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
  }

  // Auto-detect granularity: same day → "day", else use provided or "week"
  const days = (weekEnd.getTime() - weekStart.getTime()) / 86_400_000;
  const granularity: "week" | "day" = days === 0 ? "day" : (body.granularity ?? "week");

  const db = getDb();

  await db
    .insert(adPeriods)
    .values({ storeId, weekStart, weekEnd, granularity })
    .onConflictDoUpdate({
      target: [adPeriods.storeId, adPeriods.weekStart, adPeriods.weekEnd],
      set: { granularity },
    });

  return NextResponse.json({
    ok: true,
    period: {
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      granularity,
    },
  });
}
