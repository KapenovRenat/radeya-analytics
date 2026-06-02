/**
 * Drizzle schema for radeya-analytics.
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

// ─── Kaspi Advertising (ad_*) ────────────────────────────────────────────────

/**
 * Рекламные кампании Kaspi.
 * Общий справочник: и для РНП-контроля, и для будущего API Kaspi Marketing.
 * status: "on" | "off"
 * rating: "good" | "normal" | "bad" | "no_data"
 */
export const adCampaigns = pgTable(
  "ad_campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => kaspiStores.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    status: text("status").notNull().default("on"), // on | off
    improveCard: text("improve_card").default("no"), // "yes" | "no" | "maybe"
    hasReviews: boolean("has_reviews").default(false),
    hasDiscount: boolean("has_discount").default(false),
    inStock: boolean("in_stock").default(false),
    hasVideo: boolean("has_video").default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_ad_campaigns_store_name").on(t.storeId, t.name),
    index("ad_campaigns_store_idx").on(t.storeId),
  ],
);

/**
 * Метрики кампании по неделям (и итог за месяц).
 * is_monthly_total = true → строка «Итого за месяц».
 * revenue заполняется только для итоговой строки.
 */
export const adWeeklyStats = pgTable(
  "ad_weekly_stats",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => adCampaigns.id, { onDelete: "cascade" }),
    storeId: uuid("store_id")
      .notNull()
      .references(() => kaspiStores.id, { onDelete: "cascade" }),
    weekStart: timestamp("week_start", { withTimezone: true }).notNull(),
    weekEnd: timestamp("week_end", { withTimezone: true }).notNull(),
    isMonthlyTotal: boolean("is_monthly_total").notNull().default(false),
    granularity: text("granularity").notNull().default("week"), // "week" | "day" | "month"
    impressions: integer("impressions").default(0),
    spent: doublePrecision("spent").default(0),
    dailyBudget: doublePrecision("daily_budget").default(0),
    targetClick: doublePrecision("target_click").default(0), // установленная цена за клик (вручную)
    avgClick: doublePrecision("avg_click").default(0),
    orders: integer("orders").default(0),
    revenue: doublePrecision("revenue").default(0),
    drrPct: doublePrecision("drr_pct").default(0),
    ctrPct: doublePrecision("ctr_pct").default(0),
    convCartPct: doublePrecision("conv_cart_pct").default(0),
    convFavPct: doublePrecision("conv_fav_pct").default(0),
    rating: text("rating").default("no_data"), // good | normal | bad | no_data
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_ad_weekly_stats").on(t.campaignId, t.weekStart, t.isMonthlyTotal, t.granularity),
    index("ad_weekly_stats_store_idx").on(t.storeId),
    index("ad_weekly_stats_campaign_idx").on(t.campaignId),
    index("ad_weekly_stats_period_idx").on(t.weekStart, t.weekEnd),
  ],
);

/**
 * Товары внутри рекламной кампании.
 * Каждый SKU (название + категория) — отдельная строка.
 */
export const adProducts = pgTable(
  "ad_products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => adCampaigns.id, { onDelete: "cascade" }),
    storeId: uuid("store_id")
      .notNull()
      .references(() => kaspiStores.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: text("category"),
    status: text("status").default("active"), // active | inactive
    improveCard: text("improve_card").default("no"), // "yes" | "no" | "maybe"
    hasReviews: boolean("has_reviews").default(false),
    hasDiscount: boolean("has_discount").default(false),
    inStock: boolean("in_stock").default(false),
    hasVideo: boolean("has_video").default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_ad_products_campaign_name").on(t.campaignId, t.name),
    index("ad_products_store_idx").on(t.storeId),
    index("ad_products_campaign_idx").on(t.campaignId),
    index("ad_products_category_idx").on(t.category),
  ],
);

/**
 * Метрики товаров по неделям.
 * Привязаны к кампании и товару одновременно.
 */
export const adProductStats = pgTable(
  "ad_product_stats",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => adProducts.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => adCampaigns.id, { onDelete: "cascade" }),
    storeId: uuid("store_id")
      .notNull()
      .references(() => kaspiStores.id, { onDelete: "cascade" }),
    weekStart: timestamp("week_start", { withTimezone: true }).notNull(),
    weekEnd: timestamp("week_end", { withTimezone: true }).notNull(),
    granularity: text("granularity").notNull().default("week"), // "week" | "day"
    impressions: integer("impressions").default(0),
    spent: doublePrecision("spent").default(0),
    targetClick: doublePrecision("target_click").default(0), // установленная цена за клик (вручную)
    avgClick: doublePrecision("avg_click").default(0),
    orders: integer("orders").default(0),
    revenue: doublePrecision("revenue").default(0),
    drrPct: doublePrecision("drr_pct").default(0),
    ctrPct: doublePrecision("ctr_pct").default(0),
    convCartPct: doublePrecision("conv_cart_pct").default(0),
    convFavPct: doublePrecision("conv_fav_pct").default(0),
    rating: text("rating").default("no_data"), // good | normal | bad | no_data
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_ad_product_stats").on(t.productId, t.weekStart, t.granularity),
    index("ad_product_stats_campaign_idx").on(t.campaignId),
    index("ad_product_stats_store_idx").on(t.storeId),
    index("ad_product_stats_period_idx").on(t.weekStart, t.weekEnd),
  ],
);

/**
 * Вручную созданные периоды (плейсхолдеры).
 * Позволяют создать «следующую неделю» до загрузки данных.
 * Появляются в WeekSelector наравне с реальными данными.
 */
export const adPeriods = pgTable(
  "ad_periods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => kaspiStores.id, { onDelete: "cascade" }),
    weekStart: timestamp("week_start", { withTimezone: true }).notNull(),
    weekEnd: timestamp("week_end", { withTimezone: true }).notNull(),
    granularity: text("granularity").notNull().default("week"), // "week" | "day"
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_ad_periods").on(t.storeId, t.weekStart, t.weekEnd),
    index("ad_periods_store_idx").on(t.storeId),
  ],
);

/**
 * Store-level daily overview from «Обзорный отчёт» Kaspi CSV.
 * One row per day. Powers the /ad/overview weekly comparison page.
 */
export const adStoreOverview = pgTable(
  "ad_store_overview",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => kaspiStores.id, { onDelete: "cascade" }),
    date: timestamp("date", { withTimezone: true }).notNull(),
    impressions: integer("impressions").default(0),
    clicks: integer("clicks").default(0),
    ctrPct: doublePrecision("ctr_pct").default(0),
    avgClick: doublePrecision("avg_click").default(0),
    spent: doublePrecision("spent").default(0),
    revenue: doublePrecision("revenue").default(0),
    orders: integer("orders").default(0),
    favorites: integer("favorites").default(0),
    cart: integer("cart").default(0),
    drrPct: doublePrecision("drr_pct").default(0),
  },
  (t) => [
    uniqueIndex("uq_ad_store_overview_date").on(t.storeId, t.date),
    index("ad_store_overview_store_idx").on(t.storeId),
    index("ad_store_overview_date_idx").on(t.date),
  ],
);

// ─── Types ────────────────────────────────────────────────────────────────────

export type AdStoreOverview = typeof adStoreOverview.$inferSelect;

/**
 * Per-store Telegram report config: bot token + recipient chat IDs.
 */
export const adReportConfig = pgTable("ad_report_config", {
  storeId: uuid("store_id")
    .primaryKey()
    .references(() => kaspiStores.id, { onDelete: "cascade" }),
  botToken: text("bot_token").notNull().default(""),
  recipients: text("recipients").notNull().default(""), // comma-separated chat IDs
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AdCampaign = typeof adCampaigns.$inferSelect;
export type NewAdCampaign = typeof adCampaigns.$inferInsert;
export type AdWeeklyStat = typeof adWeeklyStats.$inferSelect;
export type NewAdWeeklyStat = typeof adWeeklyStats.$inferInsert;
export type AdProduct = typeof adProducts.$inferSelect;
export type NewAdProduct = typeof adProducts.$inferInsert;
export type AdProductStat = typeof adProductStats.$inferSelect;
export type NewAdProductStat = typeof adProductStats.$inferInsert;

export type KaspiStore = typeof kaspiStores.$inferSelect;
export type NewKaspiStore = typeof kaspiStores.$inferInsert;
export type KaspiOrder = typeof kaspiOrders.$inferSelect;
export type NewKaspiOrder = typeof kaspiOrders.$inferInsert;
export type KaspiSyncState = typeof kaspiSyncState.$inferSelect;
export type KaspiOrderEntry = typeof kaspiOrderEntries.$inferSelect;
export type NewKaspiOrderEntry = typeof kaspiOrderEntries.$inferInsert;
