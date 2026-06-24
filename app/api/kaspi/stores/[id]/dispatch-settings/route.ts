/**
 * GET  /api/kaspi/stores/[id]/dispatch-settings  — настройки отправки (или дефолты)
 * POST /api/kaspi/stores/[id]/dispatch-settings  — сохранить
 *   Body: { autoSendEnabled, delayMinutes, cronIntervalMin, dopText }
 */

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { dispatchSettings } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const DEFAULTS = {
  autoSendEnabled: true,
  delayMinutes: 60,
  cronIntervalMin: 2,
  dopText: "‼️ Паспорт приложить. Шильдик Radeya",
};

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: storeId } = await ctx.params;
  const db = getDb();
  const [row] = await db.select().from(dispatchSettings).where(eq(dispatchSettings.storeId, storeId)).limit(1);
  return NextResponse.json({
    autoSendEnabled: row?.autoSendEnabled ?? DEFAULTS.autoSendEnabled,
    delayMinutes: row?.delayMinutes ?? DEFAULTS.delayMinutes,
    cronIntervalMin: row?.cronIntervalMin ?? DEFAULTS.cronIntervalMin,
    dopText: row?.dopText ?? DEFAULTS.dopText,
    dispatchFromAt: row?.dispatchFromAt ? new Date(row.dispatchFromAt).toISOString() : null,
  });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: storeId } = await ctx.params;
  const body = await req.json() as Partial<typeof DEFAULTS> & { dispatchFromNow?: boolean; dispatchClear?: boolean };

  const db = getDb();
  const [existing] = await db.select().from(dispatchSettings).where(eq(dispatchSettings.storeId, storeId)).limit(1);

  // dispatchFromAt: only changes on explicit request, иначе сохраняем текущее
  let dispatchFromAt = existing?.dispatchFromAt ?? null;
  if (body.dispatchFromNow) dispatchFromAt = new Date();
  else if (body.dispatchClear) dispatchFromAt = null;

  const values = {
    autoSendEnabled: body.autoSendEnabled ?? DEFAULTS.autoSendEnabled,
    delayMinutes: Math.max(0, Math.floor(Number(body.delayMinutes ?? DEFAULTS.delayMinutes))),
    cronIntervalMin: Math.max(1, Math.floor(Number(body.cronIntervalMin ?? DEFAULTS.cronIntervalMin))),
    dopText: (body.dopText ?? DEFAULTS.dopText).trim() || DEFAULTS.dopText,
    dispatchFromAt,
  };

  await db
    .insert(dispatchSettings)
    .values({ storeId, ...values })
    .onConflictDoUpdate({
      target: dispatchSettings.storeId,
      set: { ...values, updatedAt: new Date() },
    });

  return NextResponse.json({ ok: true });
}
