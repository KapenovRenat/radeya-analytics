/**
 * GET  /api/kaspi/stores/[id]/suppliers
 *   Список поставщиков: distinct из товаров (products.supplier) + сохранённые
 *   контакты (suppliers). Возвращает { suppliers: [{ name, productCount, tgChatId, tgGroupId }] }
 *
 * POST /api/kaspi/stores/[id]/suppliers
 *   Сохранить контакты поставщика. Body: { name, tgChatId?, tgGroupId? }. Upsert по (storeId, name).
 */

import { NextRequest, NextResponse } from "next/server";
import { eq, and, sql, isNotNull } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { products, suppliers } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: storeId } = await ctx.params;
  const db = getDb();

  // distinct поставщики из товаров + кол-во товаров
  const distinct = await db
    .select({
      name: products.supplier,
      productCount: sql<number>`count(*)::int`,
    })
    .from(products)
    .where(and(eq(products.storeId, storeId), isNotNull(products.supplier)))
    .groupBy(products.supplier)
    .orderBy(products.supplier);

  // сохранённые контакты
  const saved = await db
    .select()
    .from(suppliers)
    .where(eq(suppliers.storeId, storeId));
  const savedMap = new Map(saved.map((s) => [s.name, s]));

  const result = distinct
    .filter((d) => d.name && d.name.trim() !== "")
    .map((d) => {
      const s = savedMap.get(d.name!);
      return {
        name: d.name!,
        productCount: d.productCount,
        tgChatId: s?.tgChatId ?? null,
        tgGroupId: s?.tgGroupId ?? null,
      };
    });

  return NextResponse.json({ suppliers: result });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: storeId } = await ctx.params;
  const body = await req.json() as { name: string; tgChatId?: string; tgGroupId?: string };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Не указан поставщик" }, { status: 400 });
  }

  const tgChatId = body.tgChatId?.trim() || null;
  const tgGroupId = body.tgGroupId?.trim() || null;

  const db = getDb();
  await db
    .insert(suppliers)
    .values({ storeId, name: body.name.trim(), tgChatId, tgGroupId })
    .onConflictDoUpdate({
      target: [suppliers.storeId, suppliers.name],
      set: { tgChatId, tgGroupId, updatedAt: new Date() },
    });

  return NextResponse.json({ ok: true });
}
