---
aliases: [radeya-analytics, проект]
tags: [проект, nextjs, kaspi]
created: 2026-05-28
updated: 2026-05-29
---

# radeya-analytics

> Платформа аналитики для продавцов Kaspi.kz. Standalone-порт потока оцифровки из RedStat.

## Содержание

### Стек

| | |
|---|---|
| Frontend | Next.js 16, React 19, Tailwind CSS v4, TypeScript |
| Backend | Next.js API Routes |
| БД | PostgreSQL + Drizzle ORM |
| Prod | Vercel Postgres |
| Dev | Локальный PostgreSQL |

### Локальный запуск

- Папка: `G:\Apps\niche-analytics` (переименовать в `radeya-analytics` при удобстве)
- БД: `postgres://postgres:kapa@localhost:5432/radeya_analytics`
- `.env.local`: `DATABASE_URL` заполнен, `POSTGRES_URL` закомментирован
- Запуск: `npm run dev` → http://localhost:3000
- Логин: `renat` / `kapa1234` (из `.env.local`, переменные `RADEYA_USER` / `RADEYA_PASS`)

### Архитектура

```
Kaspi API
  → POST /api/kaspi/stores          — добавить магазин (токен шифруется Fernet)
  → POST /api/kaspi/stores/[id]/sync — chunked sync, 3 дня за вызов
  → GET  /api/kaspi/analytics/[id]  — 10 агрегатов параллельно
  → /stores/[id]/dashboard          — React дашборд
```

### Таблицы БД

| Таблица | Назначение |
|---|---|
| `kaspi_stores` | Магазины |
| `kaspi_orders` | Заказы |
| `kaspi_sync_state` | Прогресс синхронизации |
| `kaspi_order_entries` | Позиции заказов (SKU-анализ) |

### Разделы UI (существующие)

- `/stores` — список магазинов, добавление
- `/stores/[id]/dashboard` — сводный дашборд
- `/stores/[id]/revenue` — выручка
- `/stores/[id]/orders` — заказы
- `/stores/[id]/cancellations` — отмены в пути (товары, отменённые после выдачи в отгрузку) → [[cancellations-in-transit]]
- `/stores/[id]/customers` — клиенты
- `/stores/[id]/delivery` — доставка
- `/stores/[id]/credit` — кредит
- `/stores/[id]/sku` — SKU-анализ
- `/stores/[id]/settings` — настройки + кнопка синхронизации

## Связано с

- [[owner]] — владелец проекта, бизнес Radeya
- [[rnp-feature]] — раздел РНП (в разработке)

## Источник

- README.md проекта, 2026-05-28
