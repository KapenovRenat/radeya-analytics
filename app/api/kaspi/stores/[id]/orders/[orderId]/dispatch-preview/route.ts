/**
 * GET /api/kaspi/stores/[id]/orders/[orderId]/dispatch-preview
 *
 * Превью отправки поставщику (НЕ шлёт). Для каждой позиции заказа:
 *   offerCode (артикул) → products.code → товар → поставщик → контакт + картинка.
 * Нужно чтобы проверить, что артикулы заказов совпадают с кодами товаров,
 * до построения реальной отправки.
 */

import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { kaspiOrders, kaspiOrderEntries, products, suppliers } from "@/lib/db/schema";
import { parseProductName } from "@/lib/products/parse-name";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; orderId: string }> },
) {
  const { id: storeId, orderId } = await ctx.params;
  const db = getDb();

  const [order] = await db
    .select({ orderCode: kaspiOrders.orderCode, originCity: kaspiOrders.originAddressCity })
    .from(kaspiOrders)
    .where(and(eq(kaspiOrders.id, orderId), eq(kaspiOrders.storeId, storeId)))
    .limit(1);

  if (!order) return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });

  const entries = await db
    .select({
      offerCode: kaspiOrderEntries.offerCode,
      offerName: kaspiOrderEntries.offerName,
      quantity: kaspiOrderEntries.quantity,
    })
    .from(kaspiOrderEntries)
    .where(eq(kaspiOrderEntries.orderId, orderId));

  // Контакты поставщиков (один запрос)
  const supplierRows = await db
    .select({ name: suppliers.name, tgChatId: suppliers.tgChatId, tgGroupId: suppliers.tgGroupId })
    .from(suppliers)
    .where(eq(suppliers.storeId, storeId));
  const supplierMap = new Map(supplierRows.map((s) => [s.name, s]));

  const items = [];
  for (const e of entries) {
    let matched: {
      productName: string;
      code: string | null;
      displayName: string;
      fabric: string | null;
      imageUrl: string | null;
      supplier: string | null;
      hasContact: boolean;
      target: string | null;
    } | null = null;

    if (e.offerCode) {
      const [prod] = await db
        .select({
          name: products.name,
          code: products.code,
          supplier: products.supplier,
          imageUrl: products.imageUrl,
        })
        .from(products)
        .where(and(eq(products.storeId, storeId), eq(products.code, e.offerCode)))
        .limit(1);

      if (prod) {
        const parsed = parseProductName(prod.name);
        const sup = prod.supplier ? supplierMap.get(prod.supplier) : undefined;
        const target = sup?.tgGroupId ? `группа ${sup.tgGroupId}` : sup?.tgChatId ? `чат ${sup.tgChatId}` : null;
        matched = {
          productName: prod.name,
          code: prod.code,
          displayName: parsed.displayName,
          fabric: parsed.fabric,
          imageUrl: prod.imageUrl,
          supplier: prod.supplier,
          hasContact: !!(sup?.tgGroupId || sup?.tgChatId),
          target,
        };
      }
    }

    items.push({
      offerCode: e.offerCode,
      offerName: e.offerName,
      quantity: e.quantity,
      matched,
    });
  }

  return NextResponse.json({
    orderCode: order.orderCode,
    originCity: order.originCity,
    items,
  });
}
