/**
 * Отправка заказа поставщику(ам) в Telegram.
 * Общая логика для ручной кнопки и cron (Фаза 3).
 *
 * Матчинг: позиция заказа offerCode → products.code → supplier → контакт.
 * На каждую позицию — sendPhoto (картинка обязательна). Анти-дубль через
 * идемпотентную вставку в order_dispatches (уникальный orderId+supplierName).
 */

import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  kaspiOrders, kaspiOrderEntries, products, suppliers,
  dispatchSettings, orderDispatches,
} from "@/lib/db/schema";
import { parseProductName } from "@/lib/products/parse-name";
import { sendTelegramPhoto } from "@/lib/telegram";

const DEFAULT_DOP = "‼️ Паспорт приложить. Шильдик Radeya";
// Заглушка-картинка для товаров без своего фото.
// Приоритет: DEFAULT_PRODUCT_IMAGE_URL (публичный URL, напр. Cloudinary) —
// работает и локально. Иначе фолбэк на PUBLIC_BASE_URL/no-image.png (нужен деплой).
const DEFAULT_IMAGE =
  process.env.DEFAULT_PRODUCT_IMAGE_URL?.trim() ||
  (process.env.PUBLIC_BASE_URL ? `${process.env.PUBLIC_BASE_URL.replace(/\/$/, "")}/no-image.png` : null);

export interface DispatchResult {
  ok: boolean;
  orderCode: string;
  sentSuppliers: { supplier: string; items: number }[];
  skipped: { reason: string; detail: string }[];
  alreadyDispatched: string[]; // имена поставщиков, уже отправленных ранее
  error?: string;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

interface MatchedItem {
  supplier: string;
  chatId: string;
  isGroup: boolean;
  displayName: string;
  fabric: string | null;
  code: string | null;
  imageUrl: string | null;
  handoffDate: string;
}

export async function dispatchOrder(storeId: string, orderId: string): Promise<DispatchResult> {
  const db = getDb();

  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!botToken) {
    return { ok: false, orderCode: "", sentSuppliers: [], skipped: [], alreadyDispatched: [], error: "TELEGRAM_BOT_TOKEN не задан" };
  }

  const [order] = await db
    .select({ orderCode: kaspiOrders.orderCode, originCity: kaspiOrders.originAddressCity, rawData: kaspiOrders.rawData })
    .from(kaspiOrders)
    .where(and(eq(kaspiOrders.id, orderId), eq(kaspiOrders.storeId, storeId)))
    .limit(1);
  if (!order) return { ok: false, orderCode: "", sentSuppliers: [], skipped: [], alreadyDispatched: [], error: "Заказ не найден" };

  const attrs = (order.rawData as { attributes?: { plannedDeliveryDate?: number | null } } | null)?.attributes;
  const plannedDeliveryMs = attrs?.plannedDeliveryDate ?? null; // планируемая дата доставки заказа
  const orderNo = order.orderCode.slice(-4);
  const originCity = order.originCity ?? "—";

  // Дни склада по городу отгрузки заказа
  const whDaysForCity = (prod: {
    whAstana: number | null; whPavlodar: number | null; whKostanay: number | null;
    whPetropavlovsk: number | null; whAlmaty: number | null;
  }): number => {
    const c = originCity.toLowerCase();
    if (c.includes("астан")) return prod.whAstana ?? 0;
    if (c.includes("павлодар")) return prod.whPavlodar ?? 0;
    if (c.includes("костанай")) return prod.whKostanay ?? 0;
    if (c.includes("петропавл")) return prod.whPetropavlovsk ?? 0;
    if (c.includes("алмат")) return prod.whAlmaty ?? 0;
    return 0;
  };

  // Дата сдачи = плановая дата доставки заказа − дни склада (по городу отгрузки)
  const calcHandoff = (whDays: number): string => {
    if (!plannedDeliveryMs) return "уточняется";
    const ms = plannedDeliveryMs - whDays * 86_400_000;
    return new Date(ms).toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone: "Asia/Almaty" });
  };

  const [settings] = await db.select().from(dispatchSettings).where(eq(dispatchSettings.storeId, storeId)).limit(1);
  const dopText = settings?.dopText?.trim() || DEFAULT_DOP;

  const entries = await db
    .select({ offerCode: kaspiOrderEntries.offerCode })
    .from(kaspiOrderEntries)
    .where(eq(kaspiOrderEntries.orderId, orderId));

  const supplierRows = await db
    .select({ name: suppliers.name, tgChatId: suppliers.tgChatId, tgGroupId: suppliers.tgGroupId })
    .from(suppliers)
    .where(eq(suppliers.storeId, storeId));
  const supplierMap = new Map(supplierRows.map((s) => [s.name, s]));

  const skipped: DispatchResult["skipped"] = [];
  // Группируем позиции по поставщику
  const bySupplier = new Map<string, MatchedItem[]>();

  for (const e of entries) {
    if (!e.offerCode) { skipped.push({ reason: "Нет артикула", detail: "" }); continue; }
    const [prod] = await db
      .select({
        name: products.name, code: products.code, supplier: products.supplier, imageUrl: products.imageUrl,
        whAstana: products.whAstana, whPavlodar: products.whPavlodar, whKostanay: products.whKostanay,
        whPetropavlovsk: products.whPetropavlovsk, whAlmaty: products.whAlmaty,
      })
      .from(products)
      .where(and(eq(products.storeId, storeId), eq(products.code, e.offerCode)))
      .limit(1);
    if (!prod) { skipped.push({ reason: "Товар не найден", detail: e.offerCode }); continue; }
    if (!prod.supplier) { skipped.push({ reason: "У товара нет поставщика", detail: prod.name }); continue; }
    const sup = supplierMap.get(prod.supplier);
    const chatId = sup?.tgGroupId || sup?.tgChatId;
    if (!chatId) { skipped.push({ reason: "Нет контакта поставщика", detail: prod.supplier }); continue; }

    // Картинка: своя из базы, иначе дефолтная заглушка (public/no-image.png)
    const imageUrl = prod.imageUrl || DEFAULT_IMAGE;
    if (!imageUrl) { skipped.push({ reason: "Нет картинки и не задан PUBLIC_BASE_URL для заглушки", detail: prod.name }); continue; }

    const parsed = parseProductName(prod.name);
    if (!bySupplier.has(prod.supplier)) bySupplier.set(prod.supplier, []);
    bySupplier.get(prod.supplier)!.push({
      supplier: prod.supplier,
      chatId,
      isGroup: !!sup?.tgGroupId,
      displayName: parsed.displayName,
      fabric: parsed.fabric,
      code: prod.code,
      imageUrl,
      handoffDate: calcHandoff(whDaysForCity(prod)),
    });
  }

  const sentSuppliers: DispatchResult["sentSuppliers"] = [];
  const alreadyDispatched: string[] = [];

  for (const [supplierName, items] of bySupplier) {
    // Анти-дубль: захватываем слот (заказ × поставщик)
    const claimed = await db
      .insert(orderDispatches)
      .values({
        storeId, orderId, orderCode: order.orderCode, supplierName,
        target: items[0].isGroup ? `группа ${items[0].chatId}` : `чат ${items[0].chatId}`,
        itemsCount: items.length, status: "sent",
      })
      .onConflictDoNothing({ target: [orderDispatches.orderId, orderDispatches.supplierName] })
      .returning({ id: orderDispatches.id });

    if (claimed.length === 0) { alreadyDispatched.push(supplierName); continue; }

    // Отправляем каждую позицию отдельным фото-сообщением
    let okCount = 0;
    let lastErr = "";
    for (const it of items) {
      const caption =
        `<b>ЗАКАЗ # ${esc(orderNo)} (${esc(order.orderCode)})</b>\n` +
        `🚨 <b>Каспи магазин</b> 🚨\n` +
        `Отгрузка на Zammler в г. ${esc(originCity)}\n` +
        `<b>Дата сдачи: ${esc(it.handoffDate)}</b> ✅\n\n` +
        `${esc(it.displayName)}\n` +
        `Основная ткань: ${esc(it.fabric ?? "—")}\n` +
        `Артикул изделия: ${esc(it.code ?? "—")}\n` +
        `Доп: ${esc(dopText)}`;
      const r = await sendTelegramPhoto(botToken, it.chatId, it.imageUrl!, caption);
      if (r.ok) okCount++;
      else lastErr = r.error ?? "ошибка";
    }

    if (okCount > 0) {
      await db.update(orderDispatches)
        .set({ status: "sent", itemsCount: okCount, error: lastErr || null })
        .where(and(eq(orderDispatches.orderId, orderId), eq(orderDispatches.supplierName, supplierName)));
      sentSuppliers.push({ supplier: supplierName, items: okCount });
    } else {
      // всё упало — снимаем claim, чтобы можно было повторить
      await db.delete(orderDispatches)
        .where(and(eq(orderDispatches.orderId, orderId), eq(orderDispatches.supplierName, supplierName)));
      skipped.push({ reason: "Telegram: " + lastErr, detail: supplierName });
    }
  }

  return {
    ok: sentSuppliers.length > 0,
    orderCode: order.orderCode,
    sentSuppliers,
    skipped,
    alreadyDispatched,
  };
}
