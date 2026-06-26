/**
 * GET /api/kaspi/stores/[id]/orders/[orderId]
 *
 * Один заказ со всеми полями + позиции (kaspi_order_entries) для модалки «Подробно».
 */

import { NextRequest, NextResponse } from "next/server";
import { eq, and, asc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { kaspiOrders, kaspiOrderEntries } from "@/lib/db/schema";
import { mapOrderStatus, mapOrderState } from "@/lib/kaspi/order-status";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; orderId: string }> },
) {
  const { id: storeId, orderId } = await ctx.params;
  const db = getDb();

  const [order] = await db
    .select()
    .from(kaspiOrders)
    .where(and(eq(kaspiOrders.id, orderId), eq(kaspiOrders.storeId, storeId)))
    .limit(1);

  if (!order) {
    return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });
  }

  const entries = await db
    .select({
      entryNumber: kaspiOrderEntries.entryNumber,
      offerCode: kaspiOrderEntries.offerCode,
      offerName: kaspiOrderEntries.offerName,
      quantity: kaspiOrderEntries.quantity,
      basePrice: kaspiOrderEntries.basePrice,
      totalPrice: kaspiOrderEntries.totalPrice,
    })
    .from(kaspiOrderEntries)
    .where(eq(kaspiOrderEntries.orderId, orderId))
    .orderBy(asc(kaspiOrderEntries.entryNumber));

  const attrs = (order.rawData as { attributes?: { preOrder?: boolean; kaspiDelivery?: { courierTransmissionDate?: number | null } } } | null)?.attributes;
  const ds = mapOrderStatus({
    status: order.status,
    state: order.state,
    waybillNumber: order.waybillNumber,
    preOrder: attrs?.preOrder === true,
    assembled: order.assembled ?? false,
    courierTransmitted: !!attrs?.kaspiDelivery?.courierTransmissionDate,
    deliveryMode: order.deliveryMode,
    isKaspiDelivery: order.isKaspiDelivery,
  });

  return NextResponse.json({
    order: {
      ...order,
      statusKey: ds.key,
      statusLabel: ds.label,
      statusTone: ds.tone,
      stateLabel: mapOrderState(order.state, order.isKaspiDelivery),
    },
    entries,
  });
}
