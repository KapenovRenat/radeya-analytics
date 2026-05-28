/**
 * Drizzle schema for niche-analytics.
 *
 * Mirrors RedStat tables (kaspi_stores, kaspi_orders) but with simplified
 * auth: no users table (Basic Auth in middleware), single-tenant for MVP.
 * Adds sync_state table for chunked sync progress tracking (replaces Redis).
 */
import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  doublePrecision,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const kaspiStores = pgTable(
  "kaspi_stores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    encryptedToken: text("encrypted_token").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    lastSyncStatus: text("last_sync_status"),
    lastSyncError: text("last_sync_error"),
    totalOrdersCount: integer("total_orders_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("kaspi_stores_active_idx").on(t.isActive)],
);

export const kaspiOrders = pgTable(
  "kaspi_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => kaspiStores.id, { onDelete: "cascade" }),
    orderCode: text("order_code").notNull(),
    creationDate: timestamp("creation_date", { withTimezone: true }).notNull(),
    totalPrice: doublePrecision("total_price").notNull().default(0),
    deliveryCostForSeller: doublePrecision("delivery_cost_for_seller").default(0),
    deliveryCost: doublePrecision("delivery_cost").default(0),
    status: text("status").notNull(),
    state: text("state"),
    cancellationReason: text("cancellation_reason"),
    paymentMode: text("payment_mode"),
    creditTerm: integer("credit_term"),
    deliveryMode: text("delivery_mode"),
    isKaspiDelivery: boolean("is_kaspi_delivery").default(false),
    waybillNumber: text("waybill_number"),
    isExpress: boolean("is_express").default(false),
    assembled: boolean("assembled").default(false),
    approvedByBankDate: timestamp("approved_by_bank_date", { withTimezone: true }),
    customerName: text("customer_name"),
    customerCellPhone: text("customer_cell_phone"),
    deliveryAddressCity: text("delivery_address_city"),
    deliveryAddressTown: text("delivery_address_town"),
    deliveryAddressFormatted: text("delivery_address_formatted"),
    originAddressCity: text("origin_address_city"),
    originAddressFormatted: text("origin_address_formatted"),
    rawData: jsonb("raw_data"),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_kaspi_orders_store_code").on(t.storeId, t.orderCode),
    index("kaspi_orders_store_date_idx").on(t.storeId, t.creationDate),
    index("kaspi_orders_store_status_idx").on(t.storeId, t.status),
    index("kaspi_orders_store_customer_idx").on(t.storeId, t.customerCellPhone),
    index("kaspi_orders_store_city_idx").on(t.storeId, t.deliveryAddressCity),
    index("kaspi_orders_store_payment_idx").on(t.storeId, t.paymentMode),
    index("kaspi_orders_store_delivery_idx").on(t.storeId, t.deliveryMode),
  ],
);

/**
 * Sync state replaces Redis progress from RedStat.
 * Each store has one row; updated as chunks complete.
 */
export const kaspiSyncState = pgTable("kaspi_sync_state", {
  storeId: uuid("store_id")
    .primaryKey()
    .references(() => kaspiStores.id, { onDelete: "cascade" }),
  currentChunkStart: timestamp("current_chunk_start", { withTimezone: true }),
  currentChunkEnd: timestamp("current_chunk_end", { withTimezone: true }),
  overallStart: timestamp("overall_start", { withTimezone: true }),
  overallEnd: timestamp("overall_end", { withTimezone: true }),
  totalChunks: integer("total_chunks").default(0),
  chunksDone: integer("chunks_done").default(0),
  ordersSynced: integer("orders_synced").default(0),
  status: text("status").notNull().default("idle"), // idle | running | done | failed
  lastError: text("last_error"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

/**
 * Order line items from /orders/{id}/entries endpoint.
 * Populated by the entries-sync step (separate from main orders sync).
 *
 * Powers ABC/XYZ analysis on SKU level.
 */
export const kaspiOrderEntries = pgTable(
  "kaspi_order_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => kaspiOrders.id, { onDelete: "cascade" }),
    storeId: uuid("store_id")
      .notNull()
      .references(() => kaspiStores.id, { onDelete: "cascade" }),
    entryNumber: integer("entry_number").notNull(),
    offerCode: text("offer_code"),
    offerName: text("offer_name"),
    categoryCode: text("category_code"),
    categoryTitle: text("category_title"),
    productId: text("product_id"),
    quantity: integer("quantity").notNull().default(1),
    basePrice: doublePrecision("base_price").default(0),
    totalPrice: doublePrecision("total_price").notNull().default(0),
    deliveryCost: doublePrecision("delivery_cost").default(0),
    syncedAt: timestamp("synced_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_entries_order_entryno").on(t.orderId, t.entryNumber),
    index("entries_store_offer_idx").on(t.storeId, t.offerCode),
    index("entries_store_category_idx").on(t.storeId, t.categoryTitle),
  ],
);

/**
 * Separate sync state for entries sync (independent from orders sync).
 */
export const kaspiEntriesSyncState = pgTable("kaspi_entries_sync_state", {
  storeId: uuid("store_id")
    .primaryKey()
    .references(() => kaspiStores.id, { onDelete: "cascade" }),
  totalOrders: integer("total_orders").default(0),
  ordersProcessed: integer("orders_processed").default(0),
  entriesSynced: integer("entries_synced").default(0),
  status: text("status").notNull().default("idle"),
  lastError: text("last_error"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});

export type KaspiStore = typeof kaspiStores.$inferSelect;
export type NewKaspiStore = typeof kaspiStores.$inferInsert;
export type KaspiOrder = typeof kaspiOrders.$inferSelect;
export type NewKaspiOrder = typeof kaspiOrders.$inferInsert;
export type KaspiSyncState = typeof kaspiSyncState.$inferSelect;
export type KaspiOrderEntry = typeof kaspiOrderEntries.$inferSelect;
export type NewKaspiOrderEntry = typeof kaspiOrderEntries.$inferInsert;
