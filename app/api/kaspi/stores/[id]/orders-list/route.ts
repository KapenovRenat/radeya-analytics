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
import { eq, and, or, ilike, desc, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { kaspiOrders } from "@/lib/db/schema";
import { mapOrderStatus, mapOrderState } from "@/lib/kaspi/order-status";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

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
      customerName: kaspiOrders.customerName,
      deliveryAddressCity: kaspiOrders.deliveryAddressCity,
    })
    .from(kaspiOrders)
    .where(where)
    .orderBy(desc(kaspiOrders.creationDate))
    .limit(statusFilter ? 2000 : PAGE_SIZE)
    .offset(statusFilter ? 0 : (page - 1) * PAGE_SIZE);

  let mapped = rows.map((o) => {
    const ds = mapOrderStatus(o.status, o.state, o.waybillNumber);
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

  return NextResponse.json({ orders: mapped, total, page, pageSize: PAGE_SIZE, totalPages });
}
