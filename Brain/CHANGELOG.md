# CHANGELOG

## 2026-05-28 (сессия 5)

- Баг: фильтр по дате не находил неделю 18–24 мая (weekEnd = 23:59:59 вместо 00:00:00)
- Fix DB: UPDATE ad_weekly_stats — исправлено 58 строк (weekEnd 23:59:59 → 00:00:00)
- Fix API: в campaigns/products/summary route заменён `lte(weekEnd, to)` на `lte(weekStart, to)` — теперь фильтр по weekStart, устойчив к вариациям weekEnd

## 2026-05-28 (сессия 4)

- Создан компонент `components/ad/ad-filter-bar.tsx`: пресеты 7/30/90/180/365д + date range inputs + опциональная гранулярность (День/Неделя/Месяц) + extra-слот
- Подключён на все три ad-страницы: Сводка (с гранулярностью), По кампаниям, По товарам
- По товарам: campaign select вынесен в extra-слот AdFilterBar
- Все страницы инициализируются последними 30 днями по умолчанию

## 2026-05-28 (сессия 3)

- Страница «По товарам» (`/ad/products`): таблица с группировкой по категориям, сворачиваемые секции, те же dropdowns и inline редактирование
- API GET/PATCH `/api/kaspi/ad/[storeId]/products` с фильтрами по кампании и датам
- Страница «Сводка» (`/ad/summary`): KPI-карточки, 4 графика (Recharts), топ-10 кампаний по расходу
- API GET `/api/kaspi/ad/[storeId]/summary` — агрегация за период
- Корневая страница `/ad` теперь редиректит на `/ad/summary` вместо `/ad/upload`
- TypeScript: 0 ошибок во всех новых файлах

## 2026-05-28 (сессия 2)

- Создана схема БД: ad_campaigns, ad_weekly_stats, ad_products, ad_product_stats
- Написан CSV парсер: lib/ad/csv-parser.ts (два формата, авто-рейтинг, авто-категория)
- Написан ingestion layer: lib/ad/ingest.ts (upsert, абстракция от источника)
- API routes: POST /api/kaspi/ad/[storeId]/upload/campaigns и /products
- Страница загрузки: /stores/[id]/ad/upload с drag & drop, превью файлов, результаты
- Добавлен раздел «Реклама» в сайдбар (4 пункта)
- UX решение: товары загружаются через кнопку у конкретной кампании, не общим bulk
- Страница /ad/campaigns: таблица с горизонтальным скроллом, sticky левые колонки
- Кнопка [📤 Товары] у каждой кампании → модалка загрузки товаров
- API GET/PATCH /api/kaspi/ad/[storeId]/campaigns

## 2026-05-28

- Создана папка Brain/ — база знаний проекта по образцу Obsidian vault Radeya
- Создано wiki: project, owner, kaspi-rnp, kaspi-metrics, rnp-feature, decisions
- Создано: AGENTS.md, index.md, CHANGELOG.md, raw/
- Знания перенесены из Obsidian vault: kaspi-rnp, kaspi-metrics, kaspi-ad-cabinet
- Развёртывание локально завершено: PostgreSQL, .env.local, drizzle push
