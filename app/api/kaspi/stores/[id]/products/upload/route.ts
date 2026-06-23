/**
 * POST /api/kaspi/stores/[id]/products/upload
 *
 * Принимает multipart/form-data с файлом Excel (МойСклад выгрузка товаров).
 * Парсит, upsert по (store_id, external_uuid). Картинку (imageUrl) НЕ трогает
 * при обновлении — она хранится отдельно и проставляется через модалку.
 *
 * Возвращает { upserted, total }.
 */

import { NextRequest, NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { products } from "@/lib/db/schema";
import { parseProductsXlsx } from "@/lib/products/parse";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: storeId } = await ctx.params;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
  }

  let parsed;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    parsed = parseProductsXlsx(buffer);
  } catch (err) {
    return NextResponse.json(
      { error: "Не удалось прочитать Excel: " + (err instanceof Error ? err.message : String(err)) },
      { status: 400 },
    );
  }

  if (parsed.length === 0) {
    return NextResponse.json({ error: "В файле не найдено товаров (нужны колонки UUID и Наименование)" }, { status: 400 });
  }

  const db = getDb();
  let upserted = 0;

  // Батчами по 200
  const BATCH = 200;
  for (let i = 0; i < parsed.length; i += BATCH) {
    const slice = parsed.slice(i, i + BATCH);
    await db
      .insert(products)
      .values(
        slice.map((p) => ({
          storeId,
          externalUuid: p.externalUuid,
          code: p.code,
          name: p.name,
          salePrice: p.salePrice,
          currency: p.currency,
          barcode: p.barcode,
          kaspiUrl: p.kaspiUrl,
          brand: p.brand,
          groupName: p.groupName,
          supplier: p.supplier,
          archived: p.archived,
          whAstana: p.whAstana,
          whPavlodar: p.whPavlodar,
          whKostanay: p.whKostanay,
          whPetropavlovsk: p.whPetropavlovsk,
          whAlmaty: p.whAlmaty,
          raw: p.raw,
        })),
      )
      .onConflictDoUpdate({
        target: [products.storeId, products.externalUuid],
        set: {
          code: sql`excluded.code`,
          name: sql`excluded.name`,
          salePrice: sql`excluded.sale_price`,
          currency: sql`excluded.currency`,
          barcode: sql`excluded.barcode`,
          kaspiUrl: sql`excluded.kaspi_url`,
          brand: sql`excluded.brand`,
          groupName: sql`excluded.group_name`,
          supplier: sql`excluded.supplier`,
          archived: sql`excluded.archived`,
          whAstana: sql`excluded.wh_astana`,
          whPavlodar: sql`excluded.wh_pavlodar`,
          whKostanay: sql`excluded.wh_kostanay`,
          whPetropavlovsk: sql`excluded.wh_petropavlovsk`,
          whAlmaty: sql`excluded.wh_almaty`,
          raw: sql`excluded.raw`,
          updatedAt: sql`now()`,
          // imageUrl / imagePublicId НЕ перезаписываем — картинка живёт отдельно
        },
      });
    upserted += slice.length;
  }

  return NextResponse.json({ upserted, total: parsed.length });
}
