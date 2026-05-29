# CHANGELOG

## 2026-05-29 (сессия 8)

- Спроектирована фича «Загрузка и просмотр по дням» — UX согласован с Ренатом
- Создано wiki: [[rnp-daily-breakdown]] — UX flow, детали UI, технические решения, план реализации
- Спроектирована фича «Товары в модалке кампании» — убрать «По товарам» из nav, открывать через клик на кампанию
- Создано wiki: [[rnp-products-in-modal]] — UX, изменения в nav/таблице, план реализации
- Обновлено index.md — обе новые страницы добавлены

## 2026-05-29 (сессия 7)

- **Удаление недели:** WeekSelector — иконка корзины на hover по каждой неделе → inline confirm «Удалить? Да / Нет»; API `DELETE /api/kaspi/ad/[storeId]/reset?target=week&weekStart=ISO` удаляет `ad_weekly_stats` + `ad_product_stats` за неделю; `loadWeeks` вынесен в `useCallback` чтобы `handleDeleteWeek` мог вызвать перезагрузку
- **Переименование колонки:** «Уст.клик» → «Целев. клик» в обеих таблицах (кампании и товары)
- **Comparison modal:** добавлена метрика «Конв→избранное%» (была пропущена при сборке модалки)
- **Таблица кампаний — Конв→изб%:** колонка отсутствовала в данных — добавлена (colSpan 10→11, sub-header, ячейка `convfav`); `<tfoot>` исправлен — 11 ячеек вместо 10
- **Таблица кампаний — Выручка:** раньше отображалась только для итоговой строки (monthly total); теперь показывается read-only (amber) для всех недельных периодов из CSV, monthly total остаётся редактируемым
- **Схема БД:** `ad_product_stats` — добавлен `revenue doublePrecision`; `drizzle-kit push` применён
- **ingest.ts:** `ingestProducts` теперь сохраняет `revenue` из CSV (insert + onConflictDoUpdate)
- **Таблица товаров:** `WeekStat` — добавлено поле `revenue`; COLS 9→10; добавлена колонка «Выручка» (read-only, amber); итоги по категории и grand total обновлены до 10 ячеек

## 2026-05-29 (сессия 6)

- **Block 0 — Показы (impressions):** добавлен столбец `impressions integer` в `ad_weekly_stats` и `ad_product_stats`; drizzle-kit push применён; `ingest.ts` сохраняет показы из CSV; API возвращает impressions; колонка «Показы» добавлена в обе таблицы (между Расходом и Уст.кликом)
- **Block 1 — Delete:** новый API `DELETE /api/kaspi/ad/[storeId]/reset?target=all|stats`; на странице загрузки — `DeleteSection` с двумя кнопками и confirm-диалогами (inline, без модалки)
- **Block 2 — WeekSelector:** новый компонент `components/ad/week-selector.tsx` с мультиселектом и метками «11 мая — 17 мая 2026»; новый API `GET /api/kaspi/ad/[storeId]/weeks`; оба API (campaigns/products) поддерживают `weeks[]` параметр через `inArray(weekStart, ...)`; по умолчанию выбраны последние 4 недели; `AdFilterBar` заменён кастомным filter bar с WeekSelector
- **Block 3 — Search + Sort + Total row:** поиск по названию кампании/товара (client-side); сортировка по расходу/показам/заказам/CTR/ДРР%/конверсии (по последней выбранной неделе); строка «Итого» в `<tfoot>` с суммой расхода/показов/заказов по неделям; категорийный итог в таблице товаров
- **Block 4 — Comparison modal:** кнопка «Сравнить N нед.» при ≥2 выбранных неделях; модалка с таблицей метрик (Расход/Показы/Заказы/ДРР%/CTR%/Конв→корз%/Ср.клик), дельтой Δ и спарклайнами (Recharts LineChart 80×24)
- **Block 5 — Summary update:** KPI-стрип расширен до 6 карточек (добавлена «Показы»); добавлен chart «Показы по неделям»; `weekly` данные содержат `impressions`
- TypeScript: 0 ошибок; `next build` — успешно

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
