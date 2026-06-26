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
import { sendTelegramPhotoBuffer } from "@/lib/telegram";
import { renderOrderCard, renderCancelCard } from "@/lib/dispatch/render-card";
import { deliveryType } from "@/lib/kaspi/order-status";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const SEND_DELAY_MS = 1500; // пауза между сообщениями — бережём лимиты Telegram

/** Город получателя совпадает с городом заказа (нестрого, регистронезависимо). */
function cityMatch(recipientCity: string | null, orderCity: string | null): boolean {
  if (!recipientCity || !orderCity) return false;
  const a = recipientCity.toLowerCase().trim();
  const b = orderCity.toLowerCase().trim();
  return b.includes(a) || a.includes(b);
}

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
    .select({
      orderCode: kaspiOrders.orderCode,
      status: kaspiOrders.status,
      state: kaspiOrders.state,
      deliveryMode: kaspiOrders.deliveryMode,
      isKaspiDelivery: kaspiOrders.isKaspiDelivery,
      originCity: kaspiOrders.originAddressCity,
      deliveryCity: kaspiOrders.deliveryAddressCity,
      deliveryAddress: kaspiOrders.deliveryAddressFormatted,
      customerPhone: kaspiOrders.customerCellPhone,
      rawData: kaspiOrders.rawData,
    })
    .from(kaspiOrders)
    .where(and(eq(kaspiOrders.id, orderId), eq(kaspiOrders.storeId, storeId)))
    .limit(1);
  if (!order) return { ok: false, orderCode: "", sentSuppliers: [], skipped: [], alreadyDispatched: [], error: "Заказ не найден" };

  const attrs = (order.rawData as { attributes?: { plannedDeliveryDate?: number | null; preOrder?: boolean } } | null)?.attributes;
  const plannedDeliveryMs = attrs?.plannedDeliveryDate ?? null; // планируемая дата доставки заказа
  const orderNo = order.orderCode.slice(-4);
  const originCity = order.originCity ?? "—";
  const preOrder = attrs?.preOrder === true;

  // ── Маршрут: предзаказ → реальный поставщик; наличие → внутренний получатель по типу доставки ──
  const dtype = deliveryType({ state: order.state, deliveryMode: order.deliveryMode, isKaspiDelivery: order.isKaspiDelivery });
  const mode: "supplier" | "warehouse" | "local_delivery" | null =
    preOrder ? "supplier" : dtype === "kaspi" ? "warehouse" : dtype === "own" ? "local_delivery" : null;
  if (!mode) {
    return { ok: false, orderCode: order.orderCode, sentSuppliers: [], skipped: [{ reason: "Не подлежит отправке", detail: `тип доставки: ${dtype}` }], alreadyDispatched: [] };
  }

  // Для наличия — один внутренний получатель на весь заказ (по роли + городу)
  let internalRecipient: { name: string; chatId: string; isGroup: boolean } | null = null;
  if (mode !== "supplier") {
    const matchCity = mode === "warehouse" ? order.originCity : order.deliveryCity;
    const recips = await db
      .select({ name: suppliers.name, city: suppliers.city, tgChatId: suppliers.tgChatId, tgGroupId: suppliers.tgGroupId })
      .from(suppliers)
      .where(and(eq(suppliers.storeId, storeId), eq(suppliers.role, mode)));
    const rec = recips.find((r) => cityMatch(r.city, matchCity)) ?? null;
    if (!rec) {
      return { ok: false, orderCode: order.orderCode, sentSuppliers: [], skipped: [{ reason: "Нет внутреннего получателя для города", detail: matchCity ?? "—" }], alreadyDispatched: [] };
    }
    const chatId = rec.tgGroupId || rec.tgChatId;
    if (!chatId) {
      return { ok: false, orderCode: order.orderCode, sentSuppliers: [], skipped: [{ reason: "У получателя не указан Telegram", detail: rec.name }], alreadyDispatched: [] };
    }
    internalRecipient = { name: rec.name, chatId, isGroup: !!rec.tgGroupId };
  }

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

  // Дата доставки клиенту (для газелиста) = плановая дата доставки заказа
  const deliveryDateStr = plannedDeliveryMs
    ? new Date(plannedDeliveryMs).toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone: "Asia/Almaty" })
    : "—";

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

    // Кому уходит эта позиция: поставщик товара (предзаказ) или внутренний получатель (наличие)
    let recipientName: string, chatId: string, isGroup: boolean;
    if (mode === "supplier") {
      if (!prod.supplier) { skipped.push({ reason: "У товара нет поставщика", detail: prod.name }); continue; }
      const sup = supplierMap.get(prod.supplier);
      const cid = sup?.tgGroupId || sup?.tgChatId;
      if (!cid) { skipped.push({ reason: "Нет контакта поставщика", detail: prod.supplier }); continue; }
      recipientName = prod.supplier; chatId = cid; isGroup = !!sup?.tgGroupId;
    } else {
      recipientName = internalRecipient!.name; chatId = internalRecipient!.chatId; isGroup = internalRecipient!.isGroup;
    }

    // Картинка: своя из базы, иначе дефолтная заглушка (public/no-image.png)
    const imageUrl = prod.imageUrl || DEFAULT_IMAGE;
    if (!imageUrl) { skipped.push({ reason: "Нет картинки и не задан PUBLIC_BASE_URL для заглушки", detail: prod.name }); continue; }

    const parsed = parseProductName(prod.name);
    if (!bySupplier.has(recipientName)) bySupplier.set(recipientName, []);
    bySupplier.get(recipientName)!.push({
      supplier: recipientName,
      chatId,
      isGroup,
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

    // Рендерим каждую позицию в карточку-картинку и шлём как одно фото
    let okCount = 0;
    let lastErr = "";
    for (const it of items) {
      try {
        const png = await renderOrderCard({
          imageUrl: it.imageUrl!,
          orderNo,
          orderCode: order.orderCode,
          originCity,
          handoffDate: it.handoffDate,
          displayName: it.displayName,
          fabric: it.fabric,
          code: it.code,
          dopText,
          // газелист (своя доставка) → карточка с адресом+телефоном клиента
          variant: mode === "local_delivery" ? "delivery" : "shipment",
          customerAddress: order.deliveryAddress,
          customerPhone: order.customerPhone,
          deliveryDate: deliveryDateStr,
          // фон: предзаказ → красный, наличие → зелёный
          isPreorder: preOrder,
        });
        const r = await sendTelegramPhotoBuffer(botToken, it.chatId, png);
        if (r.ok) okCount++;
        else lastErr = r.error ?? "ошибка";
      } catch (err) {
        lastErr = err instanceof Error ? err.message : String(err);
      }
      await sleep(SEND_DELAY_MS);
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

// ── Уведомление об отмене ─────────────────────────────────────────────────────
/**
 * Уведомить поставщиков об отмене заказа (картинкой). Только тех, кому уже
 * отправляли заказ (есть строка order_dispatches) и кого ещё не уведомляли.
 * type: "in_transit" (отмена в пути) | "by_customer" (отмена клиентом).
 */
export async function notifyCancellation(
  storeId: string,
  orderId: string,
  type: "in_transit" | "by_customer" | "returned",
): Promise<{ ok: boolean; notified: string[]; error?: string }> {
  const db = getDb();
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!botToken) return { ok: false, notified: [], error: "TELEGRAM_BOT_TOKEN не задан" };

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
  if (!order) return { ok: false, notified: [], error: "Заказ не найден" };

  // Получатели, кому отправляли заказ и кого ещё не уведомляли об отмене
  const targets = await db
    .select({ supplierName: orderDispatches.supplierName, cancelNotifiedAt: orderDispatches.cancelNotifiedAt })
    .from(orderDispatches)
    .where(eq(orderDispatches.orderId, orderId));
  const toNotify = targets.filter((t) => !t.cancelNotifiedAt).map((t) => t.supplierName);
  if (toNotify.length === 0) return { ok: true, notified: [] };

  const orderNo = order.orderCode.slice(-4);
  const originCity = order.originCity ?? "—";

  // Маршрут — как в dispatchOrder: предзаказ→поставщик, наличие→внутренний получатель
  const preOrder = (order.rawData as { attributes?: { preOrder?: boolean } } | null)?.attributes?.preOrder === true;
  const dtype = deliveryType({ state: order.state, deliveryMode: order.deliveryMode, isKaspiDelivery: order.isKaspiDelivery });
  const mode: "supplier" | "warehouse" | "local_delivery" | null =
    preOrder ? "supplier" : dtype === "kaspi" ? "warehouse" : dtype === "own" ? "local_delivery" : null;

  // Имя внутреннего получателя (для наличия) — по роли + городу
  let internalName: string | null = null;
  if (mode === "warehouse" || mode === "local_delivery") {
    const matchCity = mode === "warehouse" ? order.originCity : order.deliveryCity;
    const recips = await db
      .select({ name: suppliers.name, city: suppliers.city })
      .from(suppliers)
      .where(and(eq(suppliers.storeId, storeId), eq(suppliers.role, mode)));
    internalName = recips.find((r) => cityMatch(r.city, matchCity))?.name ?? null;
  }

  // Контакты + позиции
  const supplierRows = await db
    .select({ name: suppliers.name, tgChatId: suppliers.tgChatId, tgGroupId: suppliers.tgGroupId })
    .from(suppliers)
    .where(eq(suppliers.storeId, storeId));
  const supplierMap = new Map(supplierRows.map((s) => [s.name, s]));

  const entries = await db
    .select({ offerCode: kaspiOrderEntries.offerCode })
    .from(kaspiOrderEntries)
    .where(eq(kaspiOrderEntries.orderId, orderId));

  // позиции по получателю (только те, кому уже слали этот заказ)
  const bySupplier = new Map<string, { chatId: string; displayName: string; code: string | null; imageUrl: string }[]>();
  for (const e of entries) {
    if (!e.offerCode) continue;
    const [prod] = await db
      .select({ name: products.name, code: products.code, supplier: products.supplier, imageUrl: products.imageUrl })
      .from(products)
      .where(and(eq(products.storeId, storeId), eq(products.code, e.offerCode)))
      .limit(1);
    if (!prod) continue;

    // Получатель этой позиции — как при отправке заказа
    const recipientName = mode === "supplier" ? prod.supplier : internalName;
    if (!recipientName || !toNotify.includes(recipientName)) continue;

    const sup = supplierMap.get(recipientName);
    const chatId = sup?.tgGroupId || sup?.tgChatId;
    if (!chatId) continue;
    const imageUrl = prod.imageUrl || DEFAULT_IMAGE;
    if (!imageUrl) continue;
    const parsed = parseProductName(prod.name);
    if (!bySupplier.has(recipientName)) bySupplier.set(recipientName, []);
    bySupplier.get(recipientName)!.push({ chatId, displayName: parsed.displayName, code: prod.code, imageUrl });
  }

  const notified: string[] = [];
  for (const [supplierName, items] of bySupplier) {
    let okCount = 0;
    for (const it of items) {
      try {
        const png = await renderCancelCard({
          imageUrl: it.imageUrl, orderNo, orderCode: order.orderCode, type, originCity,
          displayName: it.displayName, code: it.code,
          isDelivery: mode === "local_delivery",
        });
        const r = await sendTelegramPhotoBuffer(botToken, it.chatId, png);
        if (r.ok) okCount++;
      } catch { /* ignore single item */ }
      await sleep(SEND_DELAY_MS);
    }
    if (okCount > 0) {
      await db.update(orderDispatches)
        .set({ cancelNotifiedAt: new Date() })
        .where(and(eq(orderDispatches.orderId, orderId), eq(orderDispatches.supplierName, supplierName)));
      notified.push(supplierName);
    }
  }

  return { ok: true, notified };
}
