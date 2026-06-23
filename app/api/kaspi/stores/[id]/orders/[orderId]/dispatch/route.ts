/**
 * POST /api/kaspi/stores/[id]/orders/[orderId]/dispatch
 *   Реально отправляет заказ поставщику(ам) в Telegram. Анти-дубль внутри.
 *
 * GET /api/kaspi/stores/[id]/orders/[orderId]/dispatch
 *   Возвращает был ли заказ уже отправлен ({ dispatched, suppliers: [...] }).
 */

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { orderDispatches } from "@/lib/db/schema";
import { dispatchOrder } from "@/lib/dispatch/send-order";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string; orderId: string }> }) {
  const { id: storeId, orderId } = await ctx.params;
  const result = await dispatchOrder(storeId, orderId);
  return NextResponse.json(result);
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string; orderId: string }> }) {
  const { orderId } = await ctx.params;
  const db = getDb();
  const rows = await db
    .select({ supplierName: orderDispatches.supplierName, status: orderDispatches.status, sentAt: orderDispatches.sentAt })
    .from(orderDispatches)
    .where(eq(orderDispatches.orderId, orderId));
  return NextResponse.json({ dispatched: rows.length > 0, suppliers: rows });
}

/** Сброс отправки — удаляет записи order_dispatches для заказа, чтобы можно было отправить заново. */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string; orderId: string }> }) {
  const { orderId } = await ctx.params;
  const db = getDb();
  await db.delete(orderDispatches).where(eq(orderDispatches.orderId, orderId));
  return NextResponse.json({ ok: true });
}
