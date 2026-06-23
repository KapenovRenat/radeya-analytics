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
 * История синхронизаций — одна строка на каждый завершённый (или упавший) синк.
 * Пишется в finishSync (done) и в catch-блоке stepSync (failed).
 * Питает страницу /sync (список «История синков с длительностью»).
 */
export const kaspiSyncHistory = pgTable(
  "kaspi_sync_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => kaspiStores.id, { onDelete: "cascade" }),
    periodFrom: timestamp("period_from", { withTimezone: true }),
    periodTo: timestamp("period_to", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }).notNull().defaultNow(),
    durationSec: integer("duration_sec").default(0),
    ordersSynced: integer("orders_synced").default(0),
    status: text("status").notNull(), // done | failed
    error: text("error"),
  },
  (t) => [
    index("sync_history_store_idx").on(t.storeId),
    index("sync_history_finished_idx").on(t.finishedAt),
  ],
);

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
 * Telegram report recipients — stored per store.
 */
export const tgRecipients = pgTable(
  "tg_recipients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => kaspiStores.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    chatId: text("chat_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_tg_recipients_store_chat").on(t.storeId, t.chatId),
    index("tg_recipients_store_idx").on(t.storeId),
  ],
);

export type TgRecipient = typeof tgRecipients.$inferSelect;

/**
 * Товары магазина — выгрузка из МойСклад (Excel).
 * Отображаемые/поисковые поля — отдельными колонками, всё остальное — в raw (jsonb).
 * Upsert по (store_id, external_uuid).
 */
export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => kaspiStores.id, { onDelete: "cascade" }),
    externalUuid: text("external_uuid").notNull(), // UUID из МойСклад (колонка B)
    code: text("code"),                            // Код (D)
    name: text("name").notNull(),                  // Наименование (E)
    salePrice: doublePrecision("sale_price").default(0), // Цена продажи (I)
    currency: text("currency"),                    // Валюта (J)
    barcode: text("barcode"),                      // Штрихкод EAN13 (AB)
    kaspiUrl: text("kaspi_url"),                   // Ссылка на товар в Kaspi (BN)
    brand: text("brand"),                          // Бренд (BU)
    groupName: text("group_name"),                 // Группы (A)
    supplier: text("supplier"),                    // Поставщик (AO)
    archived: boolean("archived").default(false),  // Архивный (AR)
    imageUrl: text("image_url"),                   // Cloudinary URL
    imagePublicId: text("image_public_id"),        // Cloudinary public_id (для замены/удаления)
    // Сроки по складам (дни) — для расчёта даты прибытия (колонки BV–BZ)
    whAstana: integer("wh_astana").default(0),         // Склад Астана
    whPavlodar: integer("wh_pavlodar").default(0),     // Склад Павлодар
    whKostanay: integer("wh_kostanay").default(0),     // Склад Костанай
    whPetropavlovsk: integer("wh_petropavlovsk").default(0), // Склад Петропавловск
    whAlmaty: integer("wh_almaty").default(0),         // Склад Алматы
    raw: jsonb("raw"),                             // все остальные колонки «на всякий случай»
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_products_store_external").on(t.storeId, t.externalUuid),
    index("products_store_idx").on(t.storeId),
    index("products_code_idx").on(t.code),
  ],
);

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;

/**
 * Поставщики — контакты для отправки заказов в Telegram.
 * `name` совпадает с полем «Поставщик» в товарах (products.supplier).
 * Заполняется вручную через модалку. Хранит chat ID (личка) и ID группы.
 */
export const suppliers = pgTable(
  "suppliers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => kaspiStores.id, { onDelete: "cascade" }),
    name: text("name").notNull(),          // = products.supplier
    tgChatId: text("tg_chat_id"),          // личный chat ID
    tgGroupId: text("tg_group_id"),        // ID группы (отрицательный)
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_suppliers_store_name").on(t.storeId, t.name),
    index("suppliers_store_idx").on(t.storeId),
  ],
);

export type Supplier = typeof suppliers.$inferSelect;

/**
 * Настройки авто-отправки заказов поставщику (per-store).
 */
export const dispatchSettings = pgTable("dispatch_settings", {
  storeId: uuid("store_id")
    .primaryKey()
    .references(() => kaspiStores.id, { onDelete: "cascade" }),
  autoSendEnabled: boolean("auto_send_enabled").notNull().default(true),
  delayMinutes: integer("delay_minutes").notNull().default(60),     // задержка перед отправкой
  cronIntervalMin: integer("cron_interval_min").notNull().default(2), // интервал опроса
  dopText: text("dop_text").notNull().default("‼️ Паспорт приложить. Шильдик Radeya"),
  lastCronRunAt: timestamp("last_cron_run_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type DispatchSettings = typeof dispatchSettings.$inferSelect;

/**
 * Журнал отправок заказов поставщикам (анти-дубль).
 * Одна строка на (заказ × поставщик). Уникальный индекс не даёт отправить дважды.
 */
export const orderDispatches = pgTable(
  "order_dispatches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => kaspiStores.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => kaspiOrders.id, { onDelete: "cascade" }),
    orderCode: text("order_code").notNull(),
    supplierName: text("supplier_name").notNull(),
    target: text("target"),                  // куда отправили (группа/чат + id)
    itemsCount: integer("items_count").default(0),
    status: text("status").notNull().default("sent"), // sent | failed
    error: text("error"),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_order_dispatches").on(t.orderId, t.supplierName),
    index("order_dispatches_store_idx").on(t.storeId),
    index("order_dispatches_order_idx").on(t.orderId),
  ],
);

export type OrderDispatch = typeof orderDispatches.$inferSelect;

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
export type KaspiSyncHistory = typeof kaspiSyncHistory.$inferSelect;
export type NewKaspiSyncHistory = typeof kaspiSyncHistory.$inferInsert;
export type KaspiOrderEntry = typeof kaspiOrderEntries.$inferSelect;
export type NewKaspiOrderEntry = typeof kaspiOrderEntries.$inferInsert;
