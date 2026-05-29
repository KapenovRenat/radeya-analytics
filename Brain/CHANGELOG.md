# CHANGELOG

## 2026-05-29 (сессия 13)

- **Баг: исчезновение плейсхолдера недели** — ключ дедупликации в `/weeks` API изменён с `weekStart` на `weekStart__weekEnd`; теперь недельный период (25 мая — 31 мая) и дневная запись (25 мая — 25 мая) не затирают друг друга
- **WeekSelector — группировка дней по неделям:** дни с `granularity='day'` теперь показываются как дочерние элементы внутри недели-контейнера
  - Если есть явный плейсхолдер (из `ad_periods`) — дни группируются под ним
  - Если плейсхолдера нет — авто-группировка по календарной неделе (Пн–Вс)
  - Заголовок группы: кликабельный чекбокс (выбрать/снять все дни), бейдж «N дн.», стрелка разворота
  - Удаление работает на уровне отдельного дня
  - Группы с днями разворачиваются автоматически при открытии
- **Модалка товаров:** убран отдельный вызов `/weeks`; `availableWeeks` теперь берётся из `periods` ответа `/products?campaignId=...` (только недели с реальными данными по этой кампании); фильтрация client-side
- TypeScript: 0 ошибок; `next build` — успешно

## 2026-05-29 (сессия 12)

- **Модалка товаров — WeekSelector + сравнение:** `CampaignProductsModal` получила собственный выбор недель и кнопку «Сравнить N пер.»
- Добавлены `localSelectedWeeks`, `availableWeeks`, `weeksLoading` — загружает доступные недели из `/api/kaspi/ad/[storeId]/weeks`, начальные значения берутся из `selectedWeeks` prop
- WeekSelector отображается в фильтр-баре модалки (независимо от родительской страницы)
- Кнопка «Сравнить N пер.» появляется при ≥2 выбранных периодах
- Новый компонент `ProductCompareModal`: агрегирует метрики всех товаров по каждому периоду, показывает таблицу Δ + спарклайны (Recharts), `z-[60]` чтобы рендерился поверх модалки
- `COMPARE_METRICS`: Расход/Показы/Заказы/ДРР%/CTR%/Конв→корз%/Конв→изб%/Ср.клик
- `GET /api/kaspi/ad/[storeId]/products`: `periods` теперь включает `granularity`
- TypeScript: 0 ошибок; `next build` — успешно

## 2026-05-29 (сессия 11)

- **Фича: Дневная разбивка (Feature 2)** — полная реализация
- **БД:** `drizzle-kit push` — применены изменения схемы (`granularity` в `ad_weekly_stats` / `ad_product_stats`, новая таблица `ad_periods`)
- **`lib/ad/ingest.ts`:** параметр `granularity: "week" | "day" = "week"` в обеих функциях; `onConflictDoUpdate` target обновлён под новые уникальные индексы
- **Upload routes** (campaigns + products): авто-детект `granularity` из длины периода (`days === 0` → "day")
- **`GET /api/kaspi/ad/[storeId]/weeks`:** теперь объединяет периоды из `ad_weekly_stats` + `ad_periods`, возвращает `granularity`
- **`POST /api/kaspi/ad/[storeId]/periods`:** новый endpoint — создание ручного периода-плейсхолдера в `ad_periods`
- **`DELETE /api/kaspi/ad/[storeId]/reset`:** при `target=all` и `target=week` также удаляет из `ad_periods`
- **`GET /api/kaspi/ad/[storeId]/campaigns`:** `periods` теперь включает `granularity`
- **`WeekOption`:** добавлен `granularity: "week" | "day"`
- **`fmtWeekLabel()`:** поддержка дневного формата — «пн, 26 мая 2026» при `granularity==="day"` или `weekStart===weekEnd`; добавлен 3-й аргумент `granularity?`
- **`WeekSelector`:** добавлен бейдж «день» на дневных периодах; кнопка «Создать период» с inline-формой (С/По дата-инпуты, авто-детект день/неделя)
- **`campaigns-client.tsx`:** `Period` +`granularity`; `handleCreatePeriod` callback; `onCreatePeriod` передаётся в `WeekSelector`; заголовки колонок используют `fmtWeekLabel` с `granularity`
- **`campaign-products-modal.tsx`:** `Period` +`granularity`; `fmtWeekLabel` с `granularity`
- **`products-client.tsx`:** `Period` +`granularity`; `fmtWeekLabel` с `granularity`
- TypeScript: 0 ошибок; `next build` — успешно

## 2026-05-29 (сессия 10)

- **Фича: Товары в модалке кампании** — реализовано
- Сайдбар: убран пункт «По товарам», порядок Реклама → Сводка / По компаниям / Загрузка CSV
- Новый компонент `components/ad/campaign-products-modal.tsx` — полная таблица товаров с группировкой по категориям, поиском, сортировкой, inline-редактированием, итогами
- `campaigns-client.tsx`: кнопка «📦 Товары» под названием каждой кампании → открывает модалку; selectedWeeks передаются автоматически
- TypeScript: 0 ошибок

## 2026-05-29 (сессия 9)

- Переименование проекта: `niche-analytics` → `radeya-analytics` везде в исходниках
- `package.json`: `name` обновлён
- `.env.local` / `.env.example`: переменные `NICHE_USER/NICHE_PASS` → `RADEYA_USER/RADEYA_PASS`; DB `niche_analytics` → `radeya_analytics`
- `middleware.ts`: переменные + realm обновлены
- `Brain/`: все wiki-страницы и AGENTS.md обновлены
- ⚠️ Требует: переименовать папку `G:\Apps\niche-analytics` → `radeya-analytics`; переименовать БД в PostgreSQL (`ALTER DATABASE niche_analytics RENAME TO radeya_analytics`)

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
