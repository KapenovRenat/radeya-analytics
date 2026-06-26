/**
 * GET /api/kaspi/stores/[id]/orders/[orderId]/dispatch-preview
 *
 * Превью отправки (НЕ шлёт). Показывает, куда уйдёт заказ по маршрутизации:
 *   - предзаказ → реальный поставщик товара (по артикулу)
 *   - наличие + Kaspi доставка → [Город] Кладовщик
 *   - наличие + своя доставка   → Своя доставка (газелист)
 */

import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { kaspiOrders, kaspiOrderEntries, products, suppliers } from "@/lib/db/schema";
import { parseProductName } from "@/lib/products/parse-name";
import { deliveryType } from "@/lib/kaspi/order-status";

export const dynamic = "force-dynamic";

function cityMatch(recipientCity: string | null, orderCity: string | null): boolean {
  if (!recipientCity || !orderCity) return false;
  const a = recipientCity.toLowerCase().trim();
  const b = orderCity.toLowerCase().trim();
  return b.includes(a) || a.includes(b);
}

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; orderId: string }> },
) {
  const { id: storeId, orderId } = await ctx.params;
  const db = getDb();

  const [order] = await db
    .select({
      orderCode: kaspiOrders.orderCode,
      state: kaspiOrders.state,
      deliveryMode: kaspiOrders.deliveryMode,
      isKaspiDelivery: kaspiOrders.isKaspiDelivery,
      originCity: kaspiOrders.originAddressCity,
      deliveryCity: kaspiOrders.deliveryAddressCity,
      rawData: kaspiOrders.rawData,
    })
    .from(kaspiOrders)
    .where(and(eq(kaspiOrders.id, orderId), eq(kaspiOrders.storeId, storeId)))
    .limit(1);

  if (!order) return NextResponse.json({ error: "Заказ не найден" }, { status: 404 });

  const preOrder = (order.rawData as { attributes?: { preOrder?: boolean } } | null)?.attributes?.preOrder === true;
  const dtype = deliveryType({ state: order.state, deliveryMode: order.deliveryMode, isKaspiDelivery: order.isKaspiDelivery });
  const mode: "supplier" | "warehouse" | "local_delivery" | null =
    preOrder ? "supplier" : dtype === "kaspi" ? "warehouse" : dtype === "own" ? "local_delivery" : null;

  const routeLabel =
    mode === "supplier" ? "Предзаказ → поставщику товара"
    : mode === "warehouse" ? "Наличие → [Город] Кладовщик (Kaspi доставка)"
    : mode === "local_delivery" ? "Наличие → Своя доставка"
    : "Не подлежит отправке";

  // Контакты получателей
  const supplierRows = await db
    .select({ name: suppliers.name, role: suppliers.role, city: suppliers.city, tgChatId: suppliers.tgChatId, tgGroupId: suppliers.tgGroupId })
    .from(suppliers)
    .where(eq(suppliers.storeId, storeId));
  const supplierMap = new Map(supplierRows.map((s) => [s.name, s]));

  // Для наличия — один внутренний получатель на весь заказ
  let internal: typeof supplierRows[number] | null = null;
  if (mode === "warehouse" || mode === "local_delivery") {
    const matchCity = mode === "warehouse" ? order.originCity : order.deliveryCity;
    internal = supplierRows.find((s) => s.role === mode && cityMatch(s.city, matchCity)) ?? null;
  }
  const internalContact = internal?.tgGroupId ? `группа ${internal.tgGroupId}` : internal?.tgChatId ? `чат ${internal.tgChatId}` : null;

  const entries = await db
    .select({
      offerCode: kaspiOrderEntries.offerCode,
      offerName: kaspiOrderEntries.offerName,
      quantity: kaspiOrderEntries.quantity,
    })
    .from(kaspiOrderEntries)
    .where(eq(kaspiOrderEntries.orderId, orderId));

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
        .select({ name: products.name, code: products.code, supplier: products.supplier, imageUrl: products.imageUrl })
        .from(products)
        .where(and(eq(products.storeId, storeId), eq(products.code, e.offerCode)))
        .limit(1);

      if (prod) {
        const parsed = parseProductName(prod.name);
        if (mode === "supplier") {
          const sup = prod.supplier ? supplierMap.get(prod.supplier) : undefined;
          const target = sup?.tgGroupId ? `группа ${sup.tgGroupId}` : sup?.tgChatId ? `чат ${sup.tgChatId}` : null;
          matched = {
            productName: prod.name, code: prod.code, displayName: parsed.displayName, fabric: parsed.fabric,
            imageUrl: prod.imageUrl, supplier: prod.supplier,
            hasContact: !!(sup?.tgGroupId || sup?.tgChatId), target,
          };
        } else {
          // Наличие — получатель внутренний (один на заказ)
          matched = {
            productName: prod.name, code: prod.code, displayName: parsed.displayName, fabric: parsed.fabric,
            imageUrl: prod.imageUrl, supplier: internal?.name ?? null,
            hasContact: !!internalContact, target: internalContact,
          };
        }
      }
    }

    items.push({ offerCode: e.offerCode, offerName: e.offerName, quantity: e.quantity, matched });
  }

  return NextResponse.json({
    orderCode: order.orderCode,
    originCity: order.originCity,
    route: routeLabel,
    items,
  });
}
