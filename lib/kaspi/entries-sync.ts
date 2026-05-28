/**
 * Chunked entries sync — fetches /orders/{id}/entries for orders lacking them.
 *
 * Each invocation processes ~20 orders (bounded within Vercel 60s).
 * UI polls until status === "done".
 */
import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../db/client";
import {
  kaspiEntriesSyncState,
  kaspiOrderEntries,
  kaspiOrders,
  kaspiStores,
  type NewKaspiOrderEntry,
} from "../db/schema";
import { decryptToken } from "./fernet";
import { fetchOrderEntries, type KaspiEntry } from "./entries-client";

const BATCH_PER_STEP = 20;
const PARALLEL = 6;

export interface EntriesSyncResult {
  status: "running" | "done" | "failed";
  progress: number;
  ordersProcessed: number;
  totalOrders: number;
  entriesSynced: number;
  error?: string;
}

export async function startEntriesSync(storeId: string): Promise<EntriesSyncResult> {
  const db = getDb();

  const [store] = await db.select().from(kaspiStores).where(eq(kaspiStores.id, storeId)).limit(1);
  if (!store) throw new Error("Store not found");

  // Count orders that don't have any entries yet
  const { rows } = await db.execute<{ total: number; processed: number }>(sql`
    SELECT
      COUNT(*)::int AS total,
      SUM(CASE WHEN EXISTS (SELECT 1 FROM kaspi_order_entries e WHERE e.order_id = o.id) THEN 1 ELSE 0 END)::int AS processed
    FROM kaspi_orders o
    WHERE o.store_id = ${storeId}
  `);
  const total = rows[0]?.total ?? 0;
  const processed = rows[0]?.processed ?? 0;

  const entriesRow = await db.execute<{ count: number }>(
    sql`SELECT COUNT(*)::int AS count FROM kaspi_order_entries WHERE store_id = ${storeId}`,
  );

  const values = {
    storeId,
    totalOrders: total,
    ordersProcessed: processed,
    entriesSynced: entriesRow.rows[0]?.count ?? 0,
    status: "running" as const,
    lastError: null,
    startedAt: new Date(),
    updatedAt: new Date(),
  };

  await db
    .insert(kaspiEntriesSyncState)
    .values(values)
    .onConflictDoUpdate({
      target: kaspiEntriesSyncState.storeId,
      set: values,
    });

  return {
    status: "running",
    progress: total > 0 ? processed / total : 1,
    ordersProcessed: processed,
    totalOrders: total,
    entriesSynced: entriesRow.rows[0]?.count ?? 0,
  };
}

export async function stepEntriesSync(storeId: string): Promise<EntriesSyncResult> {
  const db = getDb();

  const [store] = await db.select().from(kaspiStores).where(eq(kaspiStores.id, storeId)).limit(1);
  if (!store) throw new Error("Store not found");

  const [state] = await db
    .select()
    .from(kaspiEntriesSyncState)
    .where(eq(kaspiEntriesSyncState.storeId, storeId));
  if (!state || state.status !== "running") {
    return statusFromState(state);
  }

  // Find next batch of orders without entries
  const { rows: orderRows } = await db.execute<{ id: string; raw_id: string }>(sql`
    SELECT o.id, (o.raw_data->>'id') AS raw_id
    FROM kaspi_orders o
    WHERE o.store_id = ${storeId}
      AND NOT EXISTS (SELECT 1 FROM kaspi_order_entries e WHERE e.order_id = o.id)
    ORDER BY o.creation_date DESC
    LIMIT ${BATCH_PER_STEP}
  `);

  if (orderRows.length === 0) {
    // Done
    await db
      .update(kaspiEntriesSyncState)
      .set({ status: "done", updatedAt: new Date() })
      .where(eq(kaspiEntriesSyncState.storeId, storeId));
    const [fresh] = await db
      .select()
      .from(kaspiEntriesSyncState)
      .where(eq(kaspiEntriesSyncState.storeId, storeId));
    return statusFromState(fresh);
  }

  try {
    const token = decryptToken(store.encryptedToken);
    // Parallelize fetches
    const results: { orderId: string; entries: KaspiEntry[] }[] = [];
    for (let i = 0; i < orderRows.length; i += PARALLEL) {
      const slice = orderRows.slice(i, i + PARALLEL);
      const fetched = await Promise.all(
        slice.map(async (row) => {
          if (!row.raw_id) return { orderId: row.id, entries: [] };
          try {
            const entries = await fetchOrderEntries(token, row.raw_id);
            return { orderId: row.id, entries };
          } catch {
            return { orderId: row.id, entries: [] };
          }
        }),
      );
      results.push(...fetched);
    }

    const allRows: NewKaspiOrderEntry[] = [];
    for (const { orderId, entries } of results) {
      for (const e of entries) {
        const a = e.attributes ?? {};
        if (a.entryNumber == null) continue;
        allRows.push({
          orderId,
          storeId,
          entryNumber: a.entryNumber,
          offerCode: a.offer?.code ?? null,
          offerName: a.offer?.name ?? null,
          categoryCode: a.category?.code ?? null,
          categoryTitle: a.category?.title ?? null,
          productId: e.relationships?.product?.data?.id ?? null,
          quantity: a.quantity ?? 1,
          basePrice: a.basePrice ?? 0,
          totalPrice: a.totalPrice ?? 0,
          deliveryCost: a.deliveryCost ?? 0,
        });
      }
    }

    // For orders with 0 entries (failed fetch), insert a stub so we don't retry forever
    const ordersWithData = new Set(results.filter((r) => r.entries.length > 0).map((r) => r.orderId));
    const emptyOrders = orderRows.filter((r) => !ordersWithData.has(r.id));
    for (const o of emptyOrders) {
      allRows.push({
        orderId: o.id,
        storeId,
        entryNumber: -1,
        offerCode: null,
        offerName: null,
        categoryCode: null,
        categoryTitle: null,
        productId: null,
        quantity: 0,
        basePrice: 0,
        totalPrice: 0,
      });
    }

    if (allRows.length > 0) {
      await db.insert(kaspiOrderEntries).values(allRows).onConflictDoNothing();
    }

    const newEntriesSynced = (state.entriesSynced ?? 0) + allRows.filter((r) => r.entryNumber! >= 0).length;
    const newOrdersProcessed = (state.ordersProcessed ?? 0) + orderRows.length;
    const isDone = newOrdersProcessed >= (state.totalOrders ?? 0);

    await db
      .update(kaspiEntriesSyncState)
      .set({
        ordersProcessed: newOrdersProcessed,
        entriesSynced: newEntriesSynced,
        status: isDone ? "done" : "running",
        updatedAt: new Date(),
      })
      .where(eq(kaspiEntriesSyncState.storeId, storeId));

    return {
      status: isDone ? "done" : "running",
      progress: state.totalOrders && state.totalOrders > 0 ? newOrdersProcessed / state.totalOrders : 1,
      ordersProcessed: newOrdersProcessed,
      totalOrders: state.totalOrders ?? 0,
      entriesSynced: newEntriesSynced,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db
      .update(kaspiEntriesSyncState)
      .set({ status: "failed", lastError: msg, updatedAt: new Date() })
      .where(eq(kaspiEntriesSyncState.storeId, storeId));
    return {
      status: "failed",
      progress: 0,
      ordersProcessed: state.ordersProcessed ?? 0,
      totalOrders: state.totalOrders ?? 0,
      entriesSynced: state.entriesSynced ?? 0,
      error: msg,
    };
  }
}

function statusFromState(
  state:
    | {
        status: string;
        totalOrders: number | null;
        ordersProcessed: number | null;
        entriesSynced: number | null;
        lastError: string | null;
      }
    | undefined,
): EntriesSyncResult {
  if (!state) {
    return {
      status: "done",
      progress: 0,
      ordersProcessed: 0,
      totalOrders: 0,
      entriesSynced: 0,
    };
  }
  const total = state.totalOrders ?? 0;
  const done = state.ordersProcessed ?? 0;
  return {
    status: (state.status as EntriesSyncResult["status"]) ?? "done",
    progress: total > 0 ? done / total : 1,
    ordersProcessed: done,
    totalOrders: total,
    entriesSynced: state.entriesSynced ?? 0,
    error: state.lastError ?? undefined,
  };
}

export { and, isNull }; // re-export helpers for query authoring
