/**
 * POST   /api/kaspi/stores/[id]/products/[productId]/image
 *   Загружает картинку товара в Cloudinary и сохраняет URL в products.imageUrl.
 *   Принимает multipart/form-data:
 *     - file?     — файл картинки (drag&drop / выбор / вставка из буфера)
 *     - imageUrl? — URL картинки (вставка ссылки из интернета; Cloudinary скачает сам)
 *
 * DELETE /api/kaspi/stores/[id]/products/[productId]/image
 *   Убирает картинку (очищает imageUrl/imagePublicId в БД).
 *
 * Требует в .env.local:
 *   CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { products } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

function cloudinaryConfig() {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const key = process.env.CLOUDINARY_API_KEY;
  const secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud || !key || !secret) return null;
  return { cloud, key, secret };
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string; productId: string }> },
) {
  const { id: storeId, productId } = await ctx.params;

  const cfg = cloudinaryConfig();
  if (!cfg) {
    return NextResponse.json(
      { error: "Cloudinary не настроен — добавь CLOUDINARY_* в .env.local" },
      { status: 503 },
    );
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const imageUrl = (formData.get("imageUrl") as string | null)?.trim() || null;

  if (!file && !imageUrl) {
    return NextResponse.json({ error: "Не передан файл или ссылка на картинку" }, { status: 400 });
  }

  // Подписанная загрузка: один и тот же public_id → новая картинка заменяет старую
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = `radeya_products/${productId}`;
  const signParams = `overwrite=true&public_id=${publicId}&timestamp=${timestamp}`;
  const signature = crypto.createHash("sha1").update(signParams + cfg.secret).digest("hex");

  const upload = new FormData();
  if (file) {
    upload.append("file", file);
  } else if (imageUrl) {
    upload.append("file", imageUrl); // Cloudinary скачает по URL
  }
  upload.append("api_key", cfg.key);
  upload.append("timestamp", String(timestamp));
  upload.append("public_id", publicId);
  upload.append("overwrite", "true");
  upload.append("signature", signature);

  let result: { secure_url?: string; public_id?: string; error?: { message: string } };
  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cfg.cloud}/image/upload`, {
      method: "POST",
      body: upload,
    });
    result = await res.json();
  } catch (err) {
    return NextResponse.json({ error: "Ошибка загрузки в Cloudinary: " + String(err) }, { status: 502 });
  }

  if (!result.secure_url) {
    return NextResponse.json(
      { error: result.error?.message ?? "Cloudinary не вернул URL" },
      { status: 502 },
    );
  }

  const db = getDb();
  await db
    .update(products)
    .set({ imageUrl: result.secure_url, imagePublicId: result.public_id, updatedAt: new Date() })
    .where(and(eq(products.id, productId), eq(products.storeId, storeId)));

  return NextResponse.json({ imageUrl: result.secure_url });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string; productId: string }> },
) {
  const { id: storeId, productId } = await ctx.params;
  const db = getDb();
  await db
    .update(products)
    .set({ imageUrl: null, imagePublicId: null, updatedAt: new Date() })
    .where(and(eq(products.id, productId), eq(products.storeId, storeId)));
  return NextResponse.json({ ok: true });
}
