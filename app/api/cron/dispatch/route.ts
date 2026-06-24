/**
 * POST /api/cron/dispatch
 *
 * Авто-отправка заказов поставщикам. Дёргается системным cron на VPS (раз в минуту).
 * Защита: заголовок `x-cron-secret` должен совпадать с env CRON_SECRET.
 *
 * За вызов (по каждому магазину):
 *   1. Gate по интервалу: работаем только если прошло ≥ cronIntervalMin с lastCronRunAt.
 *   2. Если авто-отправка выключена — пропускаем магазин.
 *   3. Синк заказов за 14 дней + состав (инкрементально, с лимитом шагов).
 *   4. Находим заказы: статус Новый/Предзаказ, возраст ≥ задержки, ещё не отправлены.
 *   5. dispatchOrder() на каждый — матчинг + отправка + анти-дубль.
 *      Нет поставщика/контакта → позиция пропускается (внутри dispatchOrder).
 */

import { NextRequest, NextResponse } from "next/server";
import { eq, and, gte, lte, sql, isNull, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { kaspiStores, kaspiOrders, dispatchSettings, orderDispatches } from "@/lib/db/schema";
import { startSync, stepSync } from "@/lib/kaspi/sync";
import { startEntriesSync, stepEntriesSync } from "@/lib/kaspi/entries-sync";
import { mapOrderStatus } from "@/lib/kaspi/order-status";
import { dispatchOrder, notifyCancellation } from "@/lib/dispatch/send-order";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Статусы, при которых шлём поставщику. Только предзаказ — обычные (в наличии) отгружаем сами.
const DISPATCHABLE = new Set(["preorder"]);
// Лимиты за один тик cron (бережём лимиты Telegram + время запроса)
const MAX_DISPATCH_PER_RUN = 5;
const MAX_CANCEL_PER_RUN = 5;

async function runOrdersSync(storeId: string) {
  const to = new Date();
  const from = new Date(to.getTime() - 14 * 86_400_000);
  await startSync(storeId, { from, to, force: true });
  for (let i = 0; i < 60; i++) {
    const r = await stepSync(storeId);
    if (r.status !== "running") break;
  }
}

async function runEntriesSync(storeId: string) {
  await startEntriesSync(storeId);
  // лимит шагов за вызов — чтобы запрос не висел; добьём за следующие тики
  for (let i = 0; i < 40; i++) {
    const r = await stepEntriesSync(storeId);
    if (r.status !== "running") break;
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = getDb();
  const stores = await db.select({ id: kaspiStores.id }).from(kaspiStores);

  const report: Record<string, unknown>[] = [];

  for (const store of stores) {
    const storeId = store.id;
    try {
      // 1. Настройки + дефолты
      const [settings] = await db.select().from(dispatchSettings).where(eq(dispatchSettings.storeId, storeId)).limit(1);
      const autoSend = settings?.autoSendEnabled ?? true;
      const delayMinutes = settings?.delayMinutes ?? 60;
      const cronIntervalMin = settings?.cronIntervalMin ?? 2;
      const lastRun = settings?.lastCronRunAt ? new Date(settings.lastCronRunAt).getTime() : 0;
      const dispatchFromAt = settings?.dispatchFromAt ? new Date(settings.dispatchFromAt) : null;

      if (!autoSend) { report.push({ storeId, skipped: "auto-send выключен" }); continue; }

      // 2. Gate по интервалу
      const now = Date.now();
      if (now - lastRun < cronIntervalMin * 60_000) {
        report.push({ storeId, skipped: "интервал не прошёл" });
        continue;
      }
      // Сразу помечаем запуск (анти-наложение)
      await db
        .insert(dispatchSettings)
        .values({ storeId, lastCronRunAt: new Date() })
        .onConflictDoUpdate({ target: dispatchSettings.storeId, set: { lastCronRunAt: new Date() } });

      // 3. Синк заказов + состав
      await runOrdersSync(storeId);
      await runEntriesSync(storeId);

      // 4. Кандидаты на отправку.
      // Нет dispatchFromAt → НИЧЕГО не шлём (только синк), чтобы не высыпать бэклог.
      let candidates: {
        id: string; status: string | null; state: string | null; waybillNumber: string | null;
        assembled: boolean | null; preOrder: string | null; courierTx: string | null;
      }[] = [];
      const cutoff = new Date(now - delayMinutes * 60_000); // возраст ≥ задержки
      if (dispatchFromAt) {
        candidates = await db
          .select({
            id: kaspiOrders.id,
            status: kaspiOrders.status,
            state: kaspiOrders.state,
            waybillNumber: kaspiOrders.waybillNumber,
            assembled: kaspiOrders.assembled,
            preOrder: sql<string | null>`${kaspiOrders.rawData}->'attributes'->>'preOrder'`,
            courierTx: sql<string | null>`${kaspiOrders.rawData}->'attributes'->'kaspiDelivery'->>'courierTransmissionDate'`,
          })
          .from(kaspiOrders)
          .where(and(
            eq(kaspiOrders.storeId, storeId),
            gte(kaspiOrders.creationDate, dispatchFromAt), // только новее точки включения
            lte(kaspiOrders.creationDate, cutoff),         // возраст ≥ задержки
          ));
      }

      // Уже отправленные
      const dispatched = await db
        .selectDistinct({ orderId: orderDispatches.orderId })
        .from(orderDispatches)
        .where(eq(orderDispatches.storeId, storeId));
      const dispatchedSet = new Set(dispatched.map((d) => d.orderId));

      let sent = 0;
      let skippedNoSupplier = 0;
      let dispatchedThisRun = 0;
      for (const o of candidates) {
        if (dispatchedThisRun >= MAX_DISPATCH_PER_RUN) break; // лимит за тик
        if (dispatchedSet.has(o.id)) continue;
        const ds = mapOrderStatus({
          status: o.status, state: o.state, waybillNumber: o.waybillNumber,
          preOrder: o.preOrder === "true", assembled: o.assembled ?? false,
          courierTransmitted: !!o.courierTx,
        });
        if (!DISPATCHABLE.has(ds.key)) continue;

        const result = await dispatchOrder(storeId, o.id);
        dispatchedThisRun++;
        if (result.sentSuppliers.length > 0) sent += result.sentSuppliers.length;
        else skippedNoSupplier++; // нет поставщика/контакта/картинки — просто пропускаем
      }

      // 5. Уведомления об отменах: отправляли заказ, теперь отменён, ещё не уведомляли
      const cancels = await db
        .select({ orderId: orderDispatches.orderId, status: kaspiOrders.status })
        .from(orderDispatches)
        .innerJoin(kaspiOrders, eq(orderDispatches.orderId, kaspiOrders.id))
        .where(and(
          eq(orderDispatches.storeId, storeId),
          isNull(orderDispatches.cancelNotifiedAt),
          inArray(kaspiOrders.status, ["CANCELLED", "CANCELLING"]),
        ));
      const seenCancel = new Set<string>();
      let cancelNotified = 0;
      for (const c of cancels) {
        if (cancelNotified >= MAX_CANCEL_PER_RUN) break;
        if (seenCancel.has(c.orderId)) continue;
        seenCancel.add(c.orderId);
        const type = c.status === "CANCELLING" ? "in_transit" : "by_customer";
        const r = await notifyCancellation(storeId, c.orderId, type);
        if (r.notified.length > 0) cancelNotified++;
      }

      report.push({ storeId, sent, skippedNoSupplier, cancelNotified, candidates: candidates.length, dispatchFromAt: dispatchFromAt?.toISOString() ?? null });
    } catch (err) {
      report.push({ storeId, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json({ ok: true, report });
}
