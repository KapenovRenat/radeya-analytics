/**
 * Mock-данные для демо-режима radeya-analytics.
 *
 * Используются на страницах когда нет подключённой БД или магазина.
 * Все компоненты которые показывают мок-данные должны явно показывать MOCK-плашку.
 */

export const MOCK_KPIS_DASHBOARD = [
  { label: "Выручка · 30д", value: "₸ 44.7М", hint: "COMPLETED-only", delta: { value: 12.4 }, tone: "default" as const },
  { label: "Заказов", value: "1 342", hint: "из них 67% kredit", delta: { value: 8.1 }, tone: "default" as const },
  { label: "Средний чек", value: "₸ 33 285", hint: "vs ₸ 30 800 в марте", delta: { value: 8.0 }, tone: "default" as const },
  { label: "% отмен", value: "16.9%", hint: "порог Kaspi 3%", delta: { value: 7.7, inverse: true }, tone: "danger" as const },
  { label: "% возвратов", value: "3.9%", hint: "стабильно", delta: { value: 0.2, inverse: true }, tone: "warning" as const },
  { label: "Клиентов", value: "1 187", hint: "из них 31% повторных", delta: { value: 14.7 }, tone: "success" as const },
];

export const MOCK_REVENUE_TIMESERIES = [
  { date: "1 апр", revenue: 1240, orders: 38 },
  { date: "4 апр", revenue: 1380, orders: 42 },
  { date: "7 апр", revenue: 1620, orders: 49 },
  { date: "10 апр", revenue: 1520, orders: 47 },
  { date: "13 апр", revenue: 1780, orders: 53 },
  { date: "16 апр", revenue: 1340, orders: 41 },
  { date: "19 апр", revenue: 980, orders: 31 },
  { date: "22 апр", revenue: 1180, orders: 36 },
  { date: "25 апр", revenue: 1490, orders: 44 },
  { date: "28 апр", revenue: 1640, orders: 48 },
  { date: "30 апр", revenue: 1820, orders: 54 },
];

export const MOCK_INSIGHTS_DASHBOARD = [
  {
    kind: "anomaly" as const,
    title: "Отмены выросли в 2×",
    body: "С 9.2% до 16.9% за апрель. 82% всех отмен — на 3 SKU в категории «Аксессуары» от одного поставщика. Подробнее в отчёте «Апрельский всплеск отмен».",
  },
  {
    kind: "trend" as const,
    title: "Kaspi Kredit стал доминирующим",
    body: "67% заказов — кредитные, ср.чек ₸184К vs ₸79К наличными. Хорошо для выручки, но кредит даёт 22% отмен против 9% prepaid.",
  },
  {
    kind: "observation" as const,
    title: "9 SKU дают 53% оборота",
    body: "Принцип Парето подтверждается. У топ-3 звёзд (`MBA13`, `IP15PR`, `S24U`) нет дополнительных конфигураций — это потеря ~₸2.5М/мес.",
  },
  {
    kind: "suggestion" as const,
    title: "Реактивировать «спящих» клиентов",
    body: "320 клиентов с последней покупкой >90 дней назад. Сегмент «At Risk» в RFM. Прогон акции с купоном -10% даст ~₸1.2М (на основе данных стрима 1).",
  },
];

export const MOCK_RECOMMENDATIONS_DASHBOARD = [
  {
    title: "Снять с витрины 3 проблемных SKU",
    body: "ACC-CHRG-AP-USBC, ACC-CABL-USBC-USBC, ACC-MOUSE-MX3S — главный источник 16.9% отмен. Каждая новая отмена ухудшает рейтинг магазина.",
    action: { label: "Открыть «Отмены и возвраты»", href: "/cancellations" },
  },
  {
    title: "Добавить конфигурации к топ-3 звёздам",
    body: "У MacBook Air M3 нет 512GB-варианта. У iPhone 15 Pro — только Titanium. Расширение ширины = +₸2-3М/мес.",
    action: { label: "ABC/XYZ матрица", href: "/sku" },
  },
  {
    title: "Запустить win-back для At Risk-сегмента",
    body: "320 клиентов, не покупали 90+ дней. Купон -10% на 14 дней. Прогноз вернёт 18-22% сегмента.",
    action: { label: "RFM-сегментация", href: "/customers" },
  },
];

// ─── Insights page — все инсайты сводно ──────────────────────────────────

export const MOCK_INSIGHTS_ALL = [
  ...MOCK_INSIGHTS_DASHBOARD,
  {
    kind: "anomaly" as const,
    title: "Просадка по средам",
    body: "Среда — стабильно самый слабый день недели (-31% vs вторник). Гипотеза: реклама не оптимизирована под середину недели.",
  },
  {
    kind: "trend" as const,
    title: "Алматы теряет долю",
    body: "Доля Алматы упала с 38% до 32% за 60 дней, при этом Шымкент и Караганда выросли. Регионы догоняют столицу.",
  },
  {
    kind: "observation" as const,
    title: "Партии 18:00-22:00 — основной канал",
    body: "62% всех заказов оформляются вечером. Запуск рекламы утром (08:00) даёт меньший ROI чем после обеда.",
  },
];

// ─── Cancellations page ──────────────────────────────────────────────────

export const MOCK_KPIS_CANCELLATIONS = [
  { label: "Отмен · 30д", value: "16.9%", hint: "порог Kaspi 3%", delta: { value: 7.7, inverse: true }, tone: "danger" as const },
  { label: "Сумма потерь", value: "₸ 2.8М", hint: "комиссии + логистика", tone: "warning" as const },
  { label: "Виновные SKU", value: "3", hint: "из 80 активных", tone: "warning" as const },
  { label: "Возвратов", value: "3.9%", hint: "ниже отмен", tone: "default" as const },
];

export const MOCK_CANCELLATION_REASONS = [
  { reason: "Брак товара", count: 89 },
  { reason: "Не соответствует описанию", count: 64 },
  { reason: "Подделка vs оригинал", count: 42 },
  { reason: "Клиент передумал", count: 28 },
  { reason: "Проблемы доставки", count: 15 },
  { reason: "Другое", count: 9 },
];
