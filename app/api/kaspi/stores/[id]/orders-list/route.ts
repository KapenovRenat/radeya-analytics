/**
 * GET /api/kaspi/stores/[id]/orders-list?page=&search=&status=
 *
 * Сырой список заказов (не агрегаты) с пагинацией 20/стр.
 *   search — по номеру заказа или имени клиента
 *   status — фильтр по отображаемому статусу (new/accepted/delivery/completed/cancelling/cancelled/returned)
 *
 * Возвращает { orders, total, page, totalPages } со статусом, уже смапленным.
 */

import { NextRequest, NextResponse } from "next/server";
import { eq, and, or, ilike, desc, sql, inArray, isNotNull } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { kaspiOrders, orderDispatches, kaspiOrderEntries, products, suppliers } from "@/lib/db/schema";
import { mapOrderStatus, mapOrderState } from "@/lib/kaspi/order-status";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

/** Город получателя совпадает с городом заказа (нестрого, регистронезависимо). */
function cityMatch(recipientCity: string | null, orderCity: string | null): boolean {
  if (!recipientCity || !orderCity) return false;
  const a = recipientCity.toLowerCase().trim();
  const b = orderCity.toLowerCase().trim();
  return b.includes(a) || a.includes(b);
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: storeId } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const search = (searchParams.get("search") ?? "").trim();
  const statusFilter = (searchParams.get("status") ?? "").trim();
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1") || 1);

  const db = getDb();

  const filters = [eq(kaspiOrders.storeId, storeId)];
  if (search) {
    const like = `%${search}%`;
    filters.push(or(ilike(kaspiOrders.orderCode, like), ilike(kaspiOrders.customerName, like))!);
  }
  const where = and(...filters);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(kaspiOrders)
    .where(where);

  // Тянем побольше и фильтруем по смапленному статусу на стороне сервера (status хранится в Kaspi-формате).
  // Для простоты: если задан statusFilter — грузим все по where и фильтруем; иначе обычная пагинация.
  const rows = await db
    .select({
      id: kaspiOrders.id,
      orderCode: kaspiOrders.orderCode,
      creationDate: kaspiOrders.creationDate,
      totalPrice: kaspiOrders.totalPrice,
      status: kaspiOrders.status,
      state: kaspiOrders.state,
      waybillNumber: kaspiOrders.waybillNumber,
      isKaspiDelivery: kaspiOrders.isKaspiDelivery,
      deliveryMode: kaspiOrders.deliveryMode,
      assembled: kaspiOrders.assembled,
      customerName: kaspiOrders.customerName,
      deliveryAddressCity: kaspiOrders.deliveryAddressCity,
      originAddressCity: kaspiOrders.originAddressCity,
      preOrder: sql<string | null>`${kaspiOrders.rawData}->'attributes'->>'preOrder'`,
      courierTx: sql<string | null>`${kaspiOrders.rawData}->'attributes'->'kaspiDelivery'->>'courierTransmissionDate'`,
    })
    .from(kaspiOrders)
    .where(where)
    .orderBy(desc(kaspiOrders.creationDate))
    .limit(statusFilter ? 2000 : PAGE_SIZE)
    .offset(statusFilter ? 0 : (page - 1) * PAGE_SIZE);

  let mapped = rows.map((o) => {
    const ds = mapOrderStatus({
      status: o.status,
      state: o.state,
      waybillNumber: o.waybillNumber,
      preOrder: o.preOrder === "true",
      assembled: o.assembled ?? false,
      courierTransmitted: !!o.courierTx,
      deliveryMode: o.deliveryMode,
      isKaspiDelivery: o.isKaspiDelivery,
    });
    return {
      id: o.id,
      orderCode: o.orderCode,
      creationDate: o.creationDate,
      totalPrice: o.totalPrice,
      statusKey: ds.key,
      statusLabel: ds.label,
      statusTone: ds.tone,
      state: mapOrderState(o.state, o.isKaspiDelivery),
      customerName: o.customerName,
      city: o.deliveryAddressCity,
      originCity: o.originAddressCity,
      dispatched: false,
      canDispatch: false,
    };
  });

  let total = count;
  let totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  if (statusFilter) {
    const filtered = mapped.filter((m) => m.statusKey === statusFilter);
    total = filtered.length;
    totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    mapped = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }

  // Отметка «отправлен поставщику» для заказов текущей страницы (не валит список при ошибке)
  const ids = mapped.map((m) => m.id);
  if (ids.length > 0) {
    try {
      const dispatched = await db
        .selectDistinct({ orderId: orderDispatches.orderId })
        .from(orderDispatches)
        .where(inArray(orderDispatches.orderId, ids));
      const dispatchedSet = new Set(dispatched.map((d) => d.orderId));
      mapped = mapped.map((m) => ({ ...m, dispatched: dispatchedSet.has(m.id) }));
    } catch {
      /* таблица ещё не создана / ошибка — оставляем dispatched=false */
    }
  }

  // canDispatch — есть ли реальный получатель с Telegram-контактом под маршрут этого заказа
  if (ids.length > 0) {
    try {
      const recips = await db
        .select({ role: suppliers.role, city: suppliers.city, tgChatId: suppliers.tgChatId, tgGroupId: suppliers.tgGroupId })
        .from(suppliers)
        .where(and(eq(suppliers.storeId, storeId), inArray(suppliers.role, ["warehouse", "local_delivery"])));
      const hasContact = (r: { tgChatId: string | null; tgGroupId: string | null }) => !!(r.tgGroupId || r.tgChatId);

      // Предзаказы, у которых есть поставщик товара с контактом
      const preorderIds = mapped.filter((m) => m.statusKey === "preorder").map((m) => m.id);
      let supplierOk = new Set<string>();
      if (preorderIds.length > 0) {
        const r = await db
          .selectDistinct({ orderId: kaspiOrderEntries.orderId })
          .from(kaspiOrderEntries)
          .innerJoin(products, and(eq(products.storeId, storeId), eq(products.code, kaspiOrderEntries.offerCode)))
          .innerJoin(suppliers, and(eq(suppliers.storeId, storeId), eq(suppliers.name, products.supplier)))
          .where(and(inArray(kaspiOrderEntries.orderId, preorderIds), or(isNotNull(suppliers.tgGroupId), isNotNull(suppliers.tgChatId))));
        supplierOk = new Set(r.map((x) => x.orderId));
      }

      mapped = mapped.map((m) => {
        let can = false;
        if (m.statusKey === "preorder") can = supplierOk.has(m.id);
        else if (m.statusKey === "packing") can = recips.some((r) => r.role === "warehouse" && hasContact(r) && cityMatch(r.city, m.originCity));
        else if (m.statusKey === "own_delivery") can = recips.some((r) => r.role === "local_delivery" && hasContact(r) && cityMatch(r.city, m.city));
        return { ...m, canDispatch: can };
      });
    } catch {
      /* ошибка — оставляем canDispatch=false (кнопка не покажется) */
    }
  }

  return NextResponse.json({ orders: mapped, total, page, pageSize: PAGE_SIZE, totalPages });
}
