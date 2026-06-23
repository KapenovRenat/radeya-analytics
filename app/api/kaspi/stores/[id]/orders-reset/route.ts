/**
 * DELETE /api/kaspi/stores/[id]/orders-reset
 *
 * Очищает ТОЛЬКО данные заказов магазина:
 *   - kaspi_orders (каскадом удаляются kaspi_order_entries — позиции)
 *   - сбрасывает состояние синхронизации (kaspi_sync_state, kaspi_entries_sync_state)
 *   - обнуляет счётчик заказов / статус последней синхронизации у магазина
 *
 * Нужно чтобы заново синхронизировать заказы с чистого листа.
 * Рекламу, товары, поставщиков НЕ трогает.
 */

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  kaspiOrders, kaspiSyncState, kaspiEntriesSyncState, kaspiStores,
} from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: storeId } = await ctx.params;
  const db = getDb();

  // Заказы (kaspi_order_entries уходят каскадом по FK onDelete: cascade)
  await db.delete(kaspiOrders).where(eq(kaspiOrders.storeId, storeId));

  // Сброс состояния синхронизации
  await db.delete(kaspiSyncState).where(eq(kaspiSyncState.storeId, storeId));
  await db.delete(kaspiEntriesSyncState).where(eq(kaspiEntriesSyncState.storeId, storeId));

  // Обнуляем счётчики у магазина
  await db
    .update(kaspiStores)
    .set({ totalOrdersCount: 0, lastSyncAt: null, lastSyncStatus: null, lastSyncError: null })
    .where(eq(kaspiStores.id, storeId));

  return NextResponse.json({ ok: true });
}
