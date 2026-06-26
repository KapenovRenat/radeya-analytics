/**
 * GET  /api/kaspi/stores/[id]/suppliers
 *   Список получателей: реальные поставщики (distinct products.supplier) + внутренние
 *   (Кладовщик/Своя доставка, авто-засеиваются). Возвращает
 *   { suppliers: [{ name, role, city, productCount, tgChatId, tgGroupId }] }
 *
 * POST /api/kaspi/stores/[id]/suppliers
 *   Сохранить контакты. Body: { name, tgChatId?, tgGroupId? }. Upsert по (storeId, name).
 */

import { NextRequest, NextResponse } from "next/server";
import { eq, and, sql, isNotNull } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { products, suppliers } from "@/lib/db/schema";
import { INTERNAL_RECIPIENTS } from "@/lib/dispatch/internal-recipients";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: storeId } = await ctx.params;
  const db = getDb();

  // Авто-засев внутренних получателей (идемпотентно) — чтобы были в списке для ввода групп
  await db
    .insert(suppliers)
    .values(INTERNAL_RECIPIENTS.map((r) => ({ storeId, name: r.name, role: r.role, city: r.city })))
    .onConflictDoNothing({ target: [suppliers.storeId, suppliers.name] });

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

  // сохранённые контакты (включая внутренних)
  const saved = await db
    .select()
    .from(suppliers)
    .where(eq(suppliers.storeId, storeId));
  const savedMap = new Map(saved.map((s) => [s.name, s]));

  // реальные поставщики (из товаров)
  const realSuppliers = distinct
    .filter((d) => d.name && d.name.trim() !== "")
    .map((d) => {
      const s = savedMap.get(d.name!);
      return {
        name: d.name!,
        role: "supplier" as const,
        city: null as string | null,
        productCount: d.productCount,
        tgChatId: s?.tgChatId ?? null,
        tgGroupId: s?.tgGroupId ?? null,
      };
    });

  // внутренние получатели (role != supplier) — сверху списка
  const internal = saved
    .filter((s) => s.role !== "supplier")
    .map((s) => ({
      name: s.name,
      role: s.role,
      city: s.city,
      productCount: 0,
      tgChatId: s.tgChatId ?? null,
      tgGroupId: s.tgGroupId ?? null,
    }));

  return NextResponse.json({ suppliers: [...internal, ...realSuppliers] });
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
