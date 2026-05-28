/**
 * Reset niche-analytics demo store to fully mock data.
 *
 * What it does (single transaction):
 *   1. DELETE existing store + all its orders/entries/sync-state (FK cascade).
 *   2. INSERT a new store record with:
 *        - new UUID (changes /stores/<id>/dashboard URL → старые ссылки 404)
 *        - name = "Ваш магазин"
 *        - encrypted_token = "REVOKED..." (невалид Fernet → sync невозможен)
 *   3. Seed ~10 000 mock orders (365 days, tech/laptops/phones).
 *   4. Seed ~13 000 order entries with ~80 SKUs across 5 categories.
 *
 * Targets prod DB. Run with:
 *   vercel env pull .env.production.local --environment=production
 *   node --env-file=.env.production.local scripts/reset-to-mock.mjs
 *   rm .env.production.local
 */
import pg from "pg";
import { randomUUID } from "node:crypto";

// ─── config ────────────────────────────────────────────────────────────────
const STORE_NAME = "Ваш магазин";
const REVOKED_TOKEN = "REVOKED__demo_store_no_kaspi_sync__not_a_fernet_ciphertext";
const TOTAL_ORDERS = 10_000;
const DAYS = 365;
// today = 2026-04-25 per env. End range at "yesterday" so today is partial.
const END_DATE = new Date("2026-04-24T23:59:59Z");
const START_DATE = new Date(END_DATE.getTime() - DAYS * 86_400_000);

// ─── seed data ─────────────────────────────────────────────────────────────
const CITIES = [
  // [city_name, weight, oblast]
  ["Алматы", 32, "Almaty"],
  ["Астана", 22, "Astana"],
  ["Шымкент", 9, "Shymkent"],
  ["Караганда", 5, "Karaganda"],
  ["Актобе", 4, "Aktobe"],
  ["Атырау", 3, "Atyrau"],
  ["Усть-Каменогорск", 3, "East KZ"],
  ["Павлодар", 3, "Pavlodar"],
  ["Костанай", 3, "Kostanay"],
  ["Тараз", 2, "Zhambyl"],
  ["Кызылорда", 2, "Kyzylorda"],
  ["Семей", 2, "Abai"],
  ["Уральск", 2, "West KZ"],
  ["Туркестан", 1, "Turkestan"],
  ["Кокшетау", 1, "Akmola"],
  ["Талдыкорган", 1, "Almaty oblast"],
  ["Петропавловск", 1, "North KZ"],
  ["Актау", 2, "Mangystau"],
  ["Темиртау", 1, "Karaganda"],
  ["Жезказган", 1, "Ulytau"],
];

const FIRST_NAMES = [
  "Айгерим", "Алия", "Айдар", "Асель", "Бауржан", "Болат", "Дамир", "Динара",
  "Ерлан", "Жанна", "Жасулан", "Игорь", "Канат", "Куаныш", "Максат", "Марат",
  "Мария", "Нурлан", "Ольга", "Руслан", "Сабина", "Сергей", "Талгат", "Тимур",
  "Александр", "Анастасия", "Андрей", "Анна", "Виктория", "Дмитрий", "Евгений",
  "Екатерина", "Елена", "Иван", "Ирина", "Михаил", "Наталья", "Николай", "Павел",
  "Светлана", "Татьяна", "Юлия", "Юрий", "Ярослав", "Гульнара", "Жибек", "Айнур",
  "Ислам", "Мадина", "Жулдыз", "Назгуль", "Сауле", "Айбек", "Темирлан", "Адильхан",
];
const LAST_NAMES = [
  "Иванов", "Петров", "Сидоров", "Кузнецов", "Смирнов", "Попов", "Соколов",
  "Лебедев", "Козлов", "Новиков", "Морозов", "Волков", "Алексеев", "Лазарев",
  "Абдулин", "Ахметов", "Балабаев", "Бекетов", "Габдуллин", "Джумабаев",
  "Ермеков", "Жунусов", "Иманов", "Касимов", "Куанышев", "Молдабеков",
  "Нурланов", "Оспанов", "Сейтов", "Тулеуов", "Утегенов", "Шакиров", "Юсупов",
  "Кайратов", "Сагатов", "Бегимбетов", "Тохтаров", "Мукашев", "Дюсембаев",
];

// SKU catalogue: 80 tech products across 5 categories.
// Format: [code, name, category, base_price]
const SKUS = [
  // Ноутбуки (premium)
  ["LAP-MBA13-M3-256", 'Apple MacBook Air 13" M3 8/256 GB', "Ноутбуки", 619_900],
  ["LAP-MBA13-M3-512", 'Apple MacBook Air 13" M3 8/512 GB', "Ноутбуки", 729_900],
  ["LAP-MBA15-M3-512", 'Apple MacBook Air 15" M3 16/512 GB', "Ноутбуки", 859_900],
  ["LAP-MBP14-M4-PRO", 'Apple MacBook Pro 14" M4 Pro 18/512 GB', "Ноутбуки", 1_259_900],
  ["LAP-MBP14-M4-MAX", 'Apple MacBook Pro 14" M4 Max 36/1TB', "Ноутбуки", 2_099_900],
  ["LAP-LEN-IDP3-15", 'Lenovo IdeaPad 3 15IAU7 i5/8/512', "Ноутбуки", 289_900],
  ["LAP-LEN-IDP5-14", 'Lenovo IdeaPad 5 14ABA7 R7/16/512', "Ноутбуки", 379_900],
  ["LAP-LEN-IDP5-PRO", 'Lenovo IdeaPad Pro 5 16IRH8 i7/16/1TB', "Ноутбуки", 599_900],
  ["LAP-LEN-LOQ-15", 'Lenovo LOQ 15IRH8 i5/16/512 RTX4050', "Ноутбуки", 549_900],
  ["LAP-LEN-LEG-PRO5", 'Lenovo Legion Pro 5 16IRX9 i7/16/1TB RTX4060', "Ноутбуки", 939_900],
  ["LAP-LEN-LEG-PRO7", 'Lenovo Legion Pro 7 16IRX9H i9/32/2TB RTX4080', "Ноутбуки", 1_589_900],
  ["LAP-LEN-TP-E14", 'Lenovo ThinkPad E14 Gen 6 i5/16/512', "Ноутбуки", 519_900],
  ["LAP-LEN-TP-X1C", 'Lenovo ThinkPad X1 Carbon Gen 12 i7/16/1TB', "Ноутбуки", 1_239_900],
  ["LAP-LEN-YOGA-S7", 'Lenovo Yoga Slim 7 14IMH9 Ultra7/16/1TB', "Ноутбуки", 749_900],
  ["LAP-AS-VB-15", 'ASUS Vivobook 15 X1504 i5/8/512', "Ноутбуки", 269_900],
  ["LAP-AS-ZB-14", 'ASUS Zenbook 14 OLED UX3405 Ultra7/16/1TB', "Ноутбуки", 829_900],
  ["LAP-AS-TUF-A15", 'ASUS TUF Gaming A15 FA507 R7/16/512 RTX4060', "Ноутбуки", 599_900],
  ["LAP-AS-ROG-G16", 'ASUS ROG Strix G16 G614JV i7/16/1TB RTX4060', "Ноутбуки", 1_039_900],
  ["LAP-AS-ROG-S18", 'ASUS ROG Strix Scar 18 G834JZ i9/32/2TB RTX4080', "Ноутбуки", 1_869_900],
  ["LAP-HP-PV-15", 'HP Pavilion 15-eg2009ny i5/8/512', "Ноутбуки", 309_900],
  ["LAP-HP-VIC-16", 'HP Victus 16-r0007ny i7/16/512 RTX4050', "Ноутбуки", 569_900],
  ["LAP-HP-OMN-16", 'HP Omen 16-wf0007ny i7/16/1TB RTX4070', "Ноутбуки", 949_900],
  ["LAP-DELL-INS-15", 'Dell Inspiron 15 3520 i5/8/512', "Ноутбуки", 279_900],
  ["LAP-DELL-XPS-13", 'Dell XPS 13 9340 Ultra7/16/1TB', "Ноутбуки", 1_159_900],
  ["LAP-DELL-G15", 'Dell G15 5530 i7/16/1TB RTX4060', "Ноутбуки", 729_900],
  ["LAP-MSI-CYB-15", 'MSI Cyborg 15 A12VE i7/16/512 RTX4050', "Ноутбуки", 549_900],
  ["LAP-MSI-RAID-18", 'MSI Raider GE78 HX i9/32/2TB RTX4090', "Ноутбуки", 2_249_900],
  ["LAP-AC-AS-3", 'Acer Aspire 3 A315-58 i3/8/256', "Ноутбуки", 189_900],
  ["LAP-AC-PRED-17", 'Acer Predator Helios 18 i9/32/2TB RTX4080', "Ноутбуки", 1_789_900],

  // Смартфоны
  ["PHN-IP15-128", "Apple iPhone 15 128 GB Black", "Смартфоны", 459_900],
  ["PHN-IP15-256", "Apple iPhone 15 256 GB Pink", "Смартфоны", 519_900],
  ["PHN-IP15PR-256", "Apple iPhone 15 Pro 256 GB Titanium", "Смартфоны", 689_900],
  ["PHN-IP15PM-512", "Apple iPhone 15 Pro Max 512 GB Black Titanium", "Смартфоны", 919_900],
  ["PHN-IP16-256", "Apple iPhone 16 256 GB Ultramarine", "Смартфоны", 569_900],
  ["PHN-IP16PR-256", "Apple iPhone 16 Pro 256 GB Desert Titanium", "Смартфоны", 749_900],
  ["PHN-IP16PM-512", "Apple iPhone 16 Pro Max 512 GB Black Titanium", "Смартфоны", 989_900],
  ["PHN-SAM-S24", "Samsung Galaxy S24 8/256 GB Onyx Black", "Смартфоны", 419_900],
  ["PHN-SAM-S24P", "Samsung Galaxy S24+ 12/256 GB Marble Gray", "Смартфоны", 519_900],
  ["PHN-SAM-S24U", "Samsung Galaxy S24 Ultra 12/512 GB Titanium Violet", "Смартфоны", 729_900],
  ["PHN-SAM-S25U", "Samsung Galaxy S25 Ultra 12/512 GB Titanium Black", "Смартфоны", 819_900],
  ["PHN-SAM-A55", "Samsung Galaxy A55 8/256 GB Awesome Iceblue", "Смартфоны", 199_900],
  ["PHN-SAM-FOLD6", "Samsung Galaxy Z Fold6 12/512 GB Silver Shadow", "Смартфоны", 1_039_900],
  ["PHN-SAM-FLIP6", "Samsung Galaxy Z Flip6 12/256 GB Mint", "Смартфоны", 569_900],
  ["PHN-XIA-14", "Xiaomi 14 12/256 GB Black", "Смартфоны", 379_900],
  ["PHN-XIA-14T", "Xiaomi 14T Pro 12/512 GB Titan Gray", "Смартфоны", 419_900],
  ["PHN-XIA-RN13PRO", "Xiaomi Redmi Note 13 Pro 8/256 GB Forest Green", "Смартфоны", 169_900],
  ["PHN-XIA-RN14", "Xiaomi Redmi Note 14 8/256 GB Midnight Black", "Смартфоны", 129_900],
  ["PHN-POCO-X7", "Xiaomi POCO X7 Pro 12/512 GB Yellow", "Смартфоны", 199_900],
  ["PHN-HON-MAGIC6", "Honor Magic6 Pro 12/512 GB Epi Green", "Смартфоны", 519_900],
  ["PHN-INF-NOTE40", "Infinix Note 40 Pro 8/256 GB Titan Gold", "Смартфоны", 119_900],

  // Планшеты
  ["TAB-IPAD-A11-128", 'Apple iPad Air 11" M2 128 GB Wi-Fi Space Gray', "Планшеты", 369_900],
  ["TAB-IPAD-A13-256", 'Apple iPad Air 13" M2 256 GB Wi-Fi Blue', "Планшеты", 519_900],
  ["TAB-IPAD-PR11", 'Apple iPad Pro 11" M4 256 GB Wi-Fi Silver', "Планшеты", 729_900],
  ["TAB-IPAD-MINI", 'Apple iPad mini 7 128 GB Wi-Fi Purple', "Планшеты", 339_900],
  ["TAB-IPAD-10", 'Apple iPad 10 64 GB Wi-Fi Silver', "Планшеты", 239_900],
  ["TAB-SAM-S10", "Samsung Galaxy Tab S10+ 12/256 GB Wi-Fi Moonstone Gray", "Планшеты", 519_900],
  ["TAB-SAM-S10U", "Samsung Galaxy Tab S10 Ultra 12/256 GB Wi-Fi Platinum Silver", "Планшеты", 689_900],
  ["TAB-SAM-A9P", "Samsung Galaxy Tab A9+ 8/128 GB Wi-Fi Graphite", "Планшеты", 109_900],
  ["TAB-XIA-PAD7", "Xiaomi Pad 7 Pro 12/256 GB Wi-Fi Green", "Планшеты", 269_900],
  ["TAB-LEN-M11", "Lenovo Tab M11 4/128 GB Wi-Fi Luna Grey", "Планшеты", 89_900],

  // Ноутбуки бюджет / нетбуки / Chromebook
  ["LAP-HW-MB-D14", 'Huawei MateBook D 14 i5/16/512', "Ноутбуки", 419_900],
  ["LAP-HW-MB-X-PRO", 'Huawei MateBook X Pro Ultra9/16/1TB', "Ноутбуки", 1_099_900],
  ["LAP-CHR-LEN-DUET", 'Lenovo IdeaPad Duet Chromebook', "Ноутбуки", 159_900],
  ["LAP-CHR-AS-CB314", 'ASUS Chromebook CB314', "Ноутбуки", 119_900],

  // Аксессуары / периферия (cheap, high-volume)
  ["ACC-AP-PRO2", "Apple AirPods Pro 2 USB-C", "Аксессуары", 159_900],
  ["ACC-AP-MAX", "Apple AirPods Max USB-C", "Аксессуары", 299_900],
  ["ACC-AP-AP4", "Apple AirPods 4 ANC", "Аксессуары", 119_900],
  ["ACC-SAM-BUDS3", "Samsung Galaxy Buds3 Pro Silver", "Аксессуары", 99_900],
  ["ACC-MOUSE-MX3S", "Logitech MX Master 3S Graphite", "Аксессуары", 49_900],
  ["ACC-KB-MX-MINI", "Logitech MX Keys Mini Graphite", "Аксессуары", 59_900],
  ["ACC-KB-K380", "Logitech K380 Multi-Device Bluetooth", "Аксессуары", 19_900],
  ["ACC-MON-DELL-27", 'Dell P2722H 27" IPS FHD', "Аксессуары", 109_900],
  ["ACC-MON-LG-27", 'LG 27GP850-B 27" IPS QHD 165Hz', "Аксессуары", 169_900],
  ["ACC-MON-SAM-32", 'Samsung Odyssey G7 32" QLED 240Hz', "Аксессуары", 339_900],
  ["ACC-SSD-SAM-1TB", "Samsung 990 PRO 1TB NVMe SSD", "Аксессуары", 49_900],
  ["ACC-SSD-WD-2TB", "WD Black SN850X 2TB NVMe SSD", "Аксессуары", 99_900],
  ["ACC-CHRG-AP-USBC", "Apple 70W USB-C Power Adapter", "Аксессуары", 27_900],
  ["ACC-CABL-USBC-USBC", "Кабель USB-C / USB-C 1м, 100W", "Аксессуары", 4_900],
  ["ACC-WATCH-AP-S10", "Apple Watch Series 10 46mm Aluminum", "Аксессуары", 269_900],
  ["ACC-WATCH-AP-ULT2", "Apple Watch Ultra 2 49mm Titanium", "Аксессуары", 499_900],
  ["ACC-WATCH-SAM-W7", "Samsung Galaxy Watch7 44mm Bluetooth", "Аксессуары", 169_900],
];

// ─── helpers ───────────────────────────────────────────────────────────────
function pickWeighted(items) {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const it of items) {
    r -= it[1];
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}
function randomInt(min, maxInclusive) {
  return Math.floor(randomBetween(min, maxInclusive + 1));
}

function randomDate() {
  // Slight uplift to weekends + recency bias for realism
  const t = START_DATE.getTime() + Math.random() * (END_DATE.getTime() - START_DATE.getTime());
  const d = new Date(t);
  // Random hour weighted to working/evening hours
  d.setUTCHours(randomInt(8, 22), randomInt(0, 59), randomInt(0, 59), 0);
  return d;
}

function randomStatus() {
  const r = Math.random();
  // 76% completed, 17% cancelled, 5% returned, 2% other
  if (r < 0.76) return "COMPLETED";
  if (r < 0.93) return "CANCELLED";
  if (r < 0.98) return "RETURNED";
  return "DELIVERY";
}

function randomPaymentMode() {
  const r = Math.random();
  if (r < 0.55) return "PAY_WITH_CREDIT";
  if (r < 0.85) return "BANK_CARD";
  return "KASPI_GOLD";
}

function randomCreditTerm() {
  const opts = [3, 6, 12, 24];
  const weights = [0.18, 0.35, 0.35, 0.12];
  const r = Math.random();
  let acc = 0;
  for (let i = 0; i < opts.length; i++) {
    acc += weights[i];
    if (r < acc) return opts[i];
  }
  return 12;
}

function randomDeliveryMode() {
  const r = Math.random();
  if (r < 0.55) return "DELIVERY_LOCAL";
  if (r < 0.78) return "DELIVERY_REGIONAL_PICKUP";
  if (r < 0.92) return "DELIVERY_REGIONAL_TODOOR";
  return "PICKUP";
}

function randomCustomerPool(n) {
  const pool = [];
  for (let i = 0; i < n; i++) {
    const fn = FIRST_NAMES[randomInt(0, FIRST_NAMES.length - 1)];
    const ln = LAST_NAMES[randomInt(0, LAST_NAMES.length - 1)];
    pool.push(`${fn} ${ln}`);
  }
  return pool;
}

function jitterPrice(base) {
  // ±3% jitter to simulate promo discounts / Kaspi Gold variations
  return Math.round(base * (0.97 + Math.random() * 0.06));
}

// ─── main ──────────────────────────────────────────────────────────────────
async function main() {
  const url = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error("Need POSTGRES_URL_NON_POOLING (preferred) or POSTGRES_URL.");
    console.error("Run: vercel env pull .env.production.local --environment=production");
    console.error("Then: node --env-file=.env.production.local scripts/reset-to-mock.mjs");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  console.log("Connected to DB.");

  try {
    await client.query("BEGIN");

    // 1. Wipe ALL existing stores (assumes single demo store; if extras exist, abort)
    const existing = await client.query("SELECT id, name FROM kaspi_stores");
    console.log(`Found ${existing.rowCount} existing store(s):`);
    for (const r of existing.rows) console.log(`  - ${r.name} (${r.id})`);

    if (existing.rowCount > 0) {
      await client.query("DELETE FROM kaspi_stores");
      console.log(`Deleted ${existing.rowCount} store(s) and all their orders/entries (cascade).`);
    }

    // 2. Create fresh demo store
    const newStoreId = randomUUID();
    await client.query(
      `INSERT INTO kaspi_stores (id, name, encrypted_token, is_active, total_orders_count, last_sync_status, last_sync_at)
       VALUES ($1, $2, $3, true, $4, 'done', NOW())`,
      [newStoreId, STORE_NAME, REVOKED_TOKEN, TOTAL_ORDERS],
    );
    console.log(`Created new store: ${STORE_NAME} (${newStoreId})`);

    // 3. Build a customer pool ~3500 unique names → ~70% one-timers, ~30% repeat (2-4 orders avg)
    const customerPool = randomCustomerPool(3500);

    // 4. Generate orders + entries
    console.log(`Generating ${TOTAL_ORDERS} orders + entries...`);
    const orders = [];
    const entries = [];
    const skuList = SKUS.map(([code, name, cat, price]) => ({ code, name, cat, price }));

    for (let i = 0; i < TOTAL_ORDERS; i++) {
      const orderId = randomUUID();
      const orderCode = String(7700_000_000 + i).padStart(10, "0"); // looks like Kaspi
      const creationDate = randomDate();
      const status = randomStatus();
      const [city, , ] = pickWeighted(CITIES);
      const customer = customerPool[randomInt(0, customerPool.length - 1)];
      const paymentMode = randomPaymentMode();
      const creditTerm = paymentMode === "PAY_WITH_CREDIT" ? randomCreditTerm() : null;
      const deliveryMode = randomDeliveryMode();
      const isKaspiDelivery = deliveryMode !== "PICKUP" && Math.random() < 0.66;
      const isExpress = isKaspiDelivery && Math.random() < 0.11;

      // 1-3 line items per order
      const itemCount = Math.random() < 0.78 ? 1 : Math.random() < 0.92 ? 2 : 3;
      let totalPrice = 0;
      const orderEntries = [];
      for (let n = 0; n < itemCount; n++) {
        const sku = skuList[randomInt(0, skuList.length - 1)];
        const qty = Math.random() < 0.94 ? 1 : 2;
        const unitPrice = jitterPrice(sku.price);
        const linePrice = unitPrice * qty;
        totalPrice += linePrice;
        orderEntries.push({
          id: randomUUID(),
          orderId,
          storeId: newStoreId,
          entryNumber: n,
          offerCode: sku.code,
          offerName: sku.name,
          categoryCode: sku.cat.toLowerCase().replace(/\s+/g, "_"),
          categoryTitle: sku.cat,
          productId: `${sku.code}-prod-${randomInt(100000, 999999)}`,
          quantity: qty,
          basePrice: sku.price,
          totalPrice: linePrice,
          deliveryCost: isKaspiDelivery ? randomInt(800, 2500) : 0,
        });
      }

      // delivery cost only on completed
      const deliveryCostForSeller =
        status === "COMPLETED" && isKaspiDelivery ? Math.round(totalPrice * 0.012 + 600) : 0;
      const deliveryCost = isKaspiDelivery ? randomInt(990, 3500) : 0;

      orders.push({
        id: orderId,
        storeId: newStoreId,
        orderCode,
        creationDate,
        totalPrice,
        deliveryCostForSeller,
        deliveryCost,
        status,
        state: status === "COMPLETED" ? "ARCHIVE" : status === "CANCELLED" ? "CANCELLED" : "NEW",
        cancellationReason:
          status === "CANCELLED"
            ? ["BUYER_CANCELLATION_BY_MERCHANT", "OUT_OF_STOCK", "DELIVERY_PROBLEMS", "BUYER_NO_REPLY"][randomInt(0, 3)]
            : null,
        paymentMode,
        creditTerm,
        deliveryMode,
        isKaspiDelivery,
        waybillNumber: isKaspiDelivery ? `WB${randomInt(100000000, 999999999)}` : null,
        isExpress,
        assembled: status === "COMPLETED" || status === "DELIVERY",
        approvedByBankDate: paymentMode === "PAY_WITH_CREDIT" ? new Date(creationDate.getTime() + 1000 * 60 * 60) : null,
        customerName: customer,
        customerCellPhone: "+0(000)-000-00-00",
        deliveryAddressCity: city,
        deliveryAddressTown: city,
        deliveryAddressFormatted: `г. ${city}, мкр. демо ${randomInt(1, 25)}, д. ${randomInt(1, 80)}`,
        originAddressCity: "Алматы",
        originAddressFormatted: "г. Алматы, ул. Демо 1",
      });
      for (const e of orderEntries) entries.push(e);
    }

    console.log(`Built ${orders.length} orders / ${entries.length} entries in memory.`);

    // 5. Bulk insert orders in chunks of 500
    console.log("Inserting orders...");
    const ORDER_CHUNK = 500;
    for (let i = 0; i < orders.length; i += ORDER_CHUNK) {
      const slice = orders.slice(i, i + ORDER_CHUNK);
      const values = [];
      const params = [];
      let p = 1;
      for (const o of slice) {
        values.push(
          `($${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++})`,
        );
        params.push(
          o.id, o.storeId, o.orderCode, o.creationDate.toISOString(), o.totalPrice,
          o.deliveryCostForSeller, o.deliveryCost, o.status, o.state, o.cancellationReason,
          o.paymentMode, o.creditTerm, o.deliveryMode, o.isKaspiDelivery, o.waybillNumber,
          o.isExpress, o.assembled, o.approvedByBankDate, o.customerName, o.customerCellPhone,
          o.deliveryAddressCity, o.deliveryAddressTown, o.deliveryAddressFormatted,
          o.originAddressCity,
        );
      }
      await client.query(
        `INSERT INTO kaspi_orders
          (id, store_id, order_code, creation_date, total_price,
           delivery_cost_for_seller, delivery_cost, status, state, cancellation_reason,
           payment_mode, credit_term, delivery_mode, is_kaspi_delivery, waybill_number,
           is_express, assembled, approved_by_bank_date, customer_name, customer_cell_phone,
           delivery_address_city, delivery_address_town, delivery_address_formatted,
           origin_address_city)
         VALUES ${values.join(",")}`,
        params,
      );
      process.stdout.write(`\r  ${Math.min(i + ORDER_CHUNK, orders.length)}/${orders.length}`);
    }
    process.stdout.write("\n");

    // 6. Bulk insert entries
    console.log("Inserting entries...");
    const ENTRY_CHUNK = 500;
    for (let i = 0; i < entries.length; i += ENTRY_CHUNK) {
      const slice = entries.slice(i, i + ENTRY_CHUNK);
      const values = [];
      const params = [];
      let p = 1;
      for (const e of slice) {
        values.push(
          `($${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++})`,
        );
        params.push(
          e.id, e.orderId, e.storeId, e.entryNumber, e.offerCode, e.offerName,
          e.categoryCode, e.categoryTitle, e.productId, e.quantity, e.basePrice,
          e.totalPrice, e.deliveryCost,
        );
      }
      await client.query(
        `INSERT INTO kaspi_order_entries
          (id, order_id, store_id, entry_number, offer_code, offer_name,
           category_code, category_title, product_id, quantity, base_price,
           total_price, delivery_cost)
         VALUES ${values.join(",")}`,
        params,
      );
      process.stdout.write(`\r  ${Math.min(i + ENTRY_CHUNK, entries.length)}/${entries.length}`);
    }
    process.stdout.write("\n");

    // 7. Sync states (mark sync done so UI doesn't offer to sync)
    await client.query(
      `INSERT INTO kaspi_sync_state (store_id, status, orders_synced, chunks_done, total_chunks, started_at, updated_at, overall_start, overall_end)
       VALUES ($1, 'done', $2, 122, 122, NOW() - INTERVAL '1 day', NOW(), $3, $4)`,
      [newStoreId, TOTAL_ORDERS, START_DATE.toISOString(), END_DATE.toISOString()],
    );
    await client.query(
      `INSERT INTO kaspi_entries_sync_state (store_id, status, total_orders, orders_processed, entries_synced, started_at, updated_at)
       VALUES ($1, 'done', $2, $3, $4, NOW() - INTERVAL '1 day', NOW())`,
      [newStoreId, TOTAL_ORDERS, TOTAL_ORDERS, entries.length],
    );

    await client.query("COMMIT");
    console.log("\n✅ Reset done.");
    console.log(`   Store ID: ${newStoreId}`);
    console.log(`   Dashboard: /stores/${newStoreId}/dashboard`);
    console.log(`   Orders: ${orders.length}, Entries: ${entries.length}`);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Error, rolled back:", err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
