/**
 * GET    /api/kaspi/stores/[id]/products?search=&page=  — список с пагинацией (20/стр) и поиском
 * DELETE /api/kaspi/stores/[id]/products                — удалить все товары магазина
 *
 * Поиск идёт по коду (code) и названию (name), регистронезависимо.
 */

import { NextRequest, NextResponse } from "next/server";
import { eq, and, or, ilike, asc, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { products } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const search = (searchParams.get("search") ?? "").trim();
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1") || 1);

  const db = getDb();

  const filters = [eq(products.storeId, id)];
  if (search) {
    const like = `%${search}%`;
    filters.push(or(ilike(products.code, like), ilike(products.name, like))!);
  }
  const where = and(...filters);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(products)
    .where(where);

  const rows = await db
    .select({
      id: products.id,
      externalUuid: products.externalUuid,
      code: products.code,
      name: products.name,
      salePrice: products.salePrice,
      currency: products.currency,
      barcode: products.barcode,
      kaspiUrl: products.kaspiUrl,
      brand: products.brand,
      supplier: products.supplier,
      imageUrl: products.imageUrl,
      whAstana: products.whAstana,
      whPavlodar: products.whPavlodar,
      whKostanay: products.whKostanay,
      whPetropavlovsk: products.whPetropavlovsk,
      whAlmaty: products.whAlmaty,
    })
    .from(products)
    .where(where)
    .orderBy(asc(products.name))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  return NextResponse.json({
    products: rows,
    total: count,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(count / PAGE_SIZE)),
  });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = getDb();
  await db.delete(products).where(eq(products.storeId, id));
  return NextResponse.json({ ok: true });
}
