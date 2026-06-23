/**
 * Chunked sync logic — stateful, Vercel-friendly.
 *
 * Each invocation of POST /api/kaspi/stores/[id]/sync processes ONE chunk.
 * UI polls the endpoint every 2-5s until status = "done".
 * This design keeps each invocation well under the 60s Vercel function limit.
 */
import { eq, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import { kaspiStores, kaspiOrders, kaspiSyncState, kaspiSyncHistory } from "../db/schema";
import { decryptToken } from "./fernet";
import { buildChunks, fetchOrdersForChunk, MAX_KASPI_DATE_RANGE_DAYS } from "./client";
import { mapKaspiOrder } from "./mapper";

export interface SyncStepResult {
  status: "running" | "done" | "failed";
  progress: number; // 0..1
  chunksDone: number;
  totalChunks: number;
  ordersSynced: number;
  currentRange?: { from: string; to: string };
  nextCallInMs?: number;
  error?: string;
}

/**
 * Kick off a new sync for a store. Initializes sync_state and computes chunks.
 * If a sync is already running, returns current state.
 */
export async function startSync(
  storeId: string,
  opts: { from?: Date; to?: Date; force?: boolean } = {},
): Promise<SyncStepResult> {
  const db = getDb();

  const [store] = await db.select().from(kaspiStores).where(eq(kaspiStores.id, storeId)).limit(1);
  if (!store) throw new Error(`Store ${storeId} not found`);

  const [existing] = await db
    .select()
    .from(kaspiSyncState)
    .where(eq(kaspiSyncState.storeId, storeId))
    .limit(1);

  if (existing && existing.status === "running" && !opts.force) {
    return stateToResult(existing);
  }

  const now = new Date();
  const overallEnd = opts.to ?? now;
  const overallStart = opts.from ?? new Date(now.getTime() - 365 * 86_400_000);
  const chunks = buildChunks(overallStart, overallEnd, MAX_KASPI_DATE_RANGE_DAYS);

  const values = {
    storeId,
    overallStart,
    overallEnd,
    totalChunks: chunks.length,
    chunksDone: 0,
    ordersSynced: 0,
    status: "running" as const,
    lastError: null,
    currentChunkStart: chunks[0]?.from ?? null,
    currentChunkEnd: chunks[0]?.to ?? null,
    startedAt: now,
    updatedAt: now,
  };

  if (existing) {
    await db.update(kaspiSyncState).set(values).where(eq(kaspiSyncState.storeId, storeId));
  } else {
    await db.insert(kaspiSyncState).values(values);
  }

  await db
    .update(kaspiStores)
    .set({ lastSyncStatus: "running", lastSyncError: null })
    .where(eq(kaspiStores.id, storeId));

  return {
    status: "running",
    progress: 0,
    chunksDone: 0,
    totalChunks: chunks.length,
    ordersSynced: 0,
    currentRange: chunks[0] ? { from: chunks[0].from.toISOString(), to: chunks[0].to.toISOString() } : undefined,
    nextCallInMs: 500,
  };
}

/**
 * Process ONE next chunk. Call repeatedly until status === "done".
 */
export async function stepSync(storeId: string): Promise<SyncStepResult> {
  const db = getDb();

  const [store] = await db.select().from(kaspiStores).where(eq(kaspiStores.id, storeId)).limit(1);
  if (!store) throw new Error(`Store ${storeId} not found`);

  const [state] = await db.select().from(kaspiSyncState).where(eq(kaspiSyncState.storeId, storeId)).limit(1);
  if (!state) throw new Error("No sync in progress — call startSync first");
  if (state.status !== "running") return stateToResult(state);

  // Compute all chunks deterministically from overallStart/End
  if (!state.overallStart || !state.overallEnd) throw new Error("Sync state corrupted: missing range");
  const chunks = buildChunks(state.overallStart, state.overallEnd, MAX_KASPI_DATE_RANGE_DAYS);
  const chunksDone = state.chunksDone ?? 0;

  if (chunksDone >= chunks.length) {
    // done
    await finishSync(storeId, "done");
    const [finalState] = await db.select().from(kaspiSyncState).where(eq(kaspiSyncState.storeId, storeId));
    return stateToResult(finalState);
  }

  const chunk = chunks[chunksDone];

  try {
    const token = decryptToken(store.encryptedToken);
    const apiOrders = await fetchOrdersForChunk(token, chunk);
    const mapped = apiOrders.map((o) => mapKaspiOrder(o, storeId)).filter((m): m is NonNullable<typeof m> => !!m);

    // Upsert in batches of 500
    const BATCH = 500;
    for (let i = 0; i < mapped.length; i += BATCH) {
      const batch = mapped.slice(i, i + BATCH);
      await db
        .insert(kaspiOrders)
        .values(batch)
        .onConflictDoUpdate({
          target: [kaspiOrders.storeId, kaspiOrders.orderCode],
          set: {
            totalPrice: sql`excluded.total_price`,
            deliveryCostForSeller: sql`excluded.delivery_cost_for_seller`,
            deliveryCost: sql`excluded.delivery_cost`,
            status: sql`excluded.status`,
            state: sql`excluded.state`,
            cancellationReason: sql`excluded.cancellation_reason`,
            paymentMode: sql`excluded.payment_mode`,
            creditTerm: sql`excluded.credit_term`,
            deliveryMode: sql`excluded.delivery_mode`,
            isKaspiDelivery: sql`excluded.is_kaspi_delivery`,
            waybillNumber: sql`excluded.waybill_number`,
            isExpress: sql`excluded.is_express`,
            assembled: sql`excluded.assembled`,
            approvedByBankDate: sql`excluded.approved_by_bank_date`,
            customerName: sql`excluded.customer_name`,
            customerCellPhone: sql`excluded.customer_cell_phone`,
            deliveryAddressCity: sql`excluded.delivery_address_city`,
            deliveryAddressTown: sql`excluded.delivery_address_town`,
            deliveryAddressFormatted: sql`excluded.delivery_address_formatted`,
            originAddressCity: sql`excluded.origin_address_city`,
            originAddressFormatted: sql`excluded.origin_address_formatted`,
            rawData: sql`excluded.raw_data`,
            syncedAt: sql`now()`,
          },
        });
    }

    const newChunksDone = chunksDone + 1;
    const newOrdersSynced = (state.ordersSynced ?? 0) + mapped.length;
    const nextChunk = chunks[newChunksDone];

    await db
      .update(kaspiSyncState)
      .set({
        chunksDone: newChunksDone,
        ordersSynced: newOrdersSynced,
        currentChunkStart: nextChunk?.from ?? null,
        currentChunkEnd: nextChunk?.to ?? null,
        status: newChunksDone >= chunks.length ? "done" : "running",
        updatedAt: new Date(),
      })
      .where(eq(kaspiSyncState.storeId, storeId));

    if (newChunksDone >= chunks.length) {
      await finishSync(storeId, "done");
    }

    return {
      status: newChunksDone >= chunks.length ? "done" : "running",
      progress: newChunksDone / chunks.length,
      chunksDone: newChunksDone,
      totalChunks: chunks.length,
      ordersSynced: newOrdersSynced,
      currentRange: nextChunk
        ? { from: nextChunk.from.toISOString(), to: nextChunk.to.toISOString() }
        : undefined,
      nextCallInMs: newChunksDone >= chunks.length ? undefined : 500,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(kaspiSyncState)
      .set({ status: "failed", lastError: message, updatedAt: new Date() })
      .where(eq(kaspiSyncState.storeId, storeId));
    await db
      .update(kaspiStores)
      .set({ lastSyncStatus: "failed", lastSyncError: message })
      .where(eq(kaspiStores.id, storeId));
    await logSyncHistory(storeId, state, "failed", message);
    return {
      status: "failed",
      progress: chunksDone / chunks.length,
      chunksDone,
      totalChunks: chunks.length,
      ordersSynced: state.ordersSynced ?? 0,
      error: message,
    };
  }
}

async function finishSync(storeId: string, finalStatus: "done" | "failed") {
  const db = getDb();
  const [state] = await db.select().from(kaspiSyncState).where(eq(kaspiSyncState.storeId, storeId));
  if (!state) return;

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(kaspiOrders)
    .where(eq(kaspiOrders.storeId, storeId));

  await db
    .update(kaspiStores)
    .set({
      lastSyncAt: new Date(),
      lastSyncStatus: finalStatus,
      totalOrdersCount: count,
    })
    .where(eq(kaspiStores.id, storeId));

  await logSyncHistory(storeId, state, finalStatus);
}

/**
 * Записать строку в историю синхронизаций (вызывается при done и failed).
 */
async function logSyncHistory(
  storeId: string,
  state: {
    overallStart: Date | null;
    overallEnd: Date | null;
    startedAt: Date | null;
    ordersSynced: number | null;
  },
  status: "done" | "failed",
  error?: string | null,
) {
  const db = getDb();
  const finishedAt = new Date();
  const durationSec = state.startedAt
    ? Math.max(0, Math.round((finishedAt.getTime() - state.startedAt.getTime()) / 1000))
    : 0;
  await db.insert(kaspiSyncHistory).values({
    storeId,
    periodFrom: state.overallStart,
    periodTo: state.overallEnd,
    startedAt: state.startedAt,
    finishedAt,
    durationSec,
    ordersSynced: state.ordersSynced ?? 0,
    status,
    error: error ?? null,
  });
}

function stateToResult(state: {
  status: string;
  totalChunks: number | null;
  chunksDone: number | null;
  ordersSynced: number | null;
  currentChunkStart: Date | null;
  currentChunkEnd: Date | null;
  lastError: string | null;
}): SyncStepResult {
  const total = state.totalChunks ?? 0;
  const done = state.chunksDone ?? 0;
  return {
    status: (state.status as SyncStepResult["status"]) ?? "failed",
    progress: total > 0 ? done / total : 0,
    chunksDone: done,
    totalChunks: total,
    ordersSynced: state.ordersSynced ?? 0,
    currentRange:
      state.currentChunkStart && state.currentChunkEnd
        ? { from: state.currentChunkStart.toISOString(), to: state.currentChunkEnd.toISOString() }
        : undefined,
    nextCallInMs: state.status === "running" ? 500 : undefined,
    error: state.lastError ?? undefined,
  };
}
