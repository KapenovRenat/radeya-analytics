# niche-analytics

Marketplace niche analytics platform. Standalone port of the Kaspi seller-cabinet
digitization flow from RedStat. Next.js 16 + Vercel Postgres + Drizzle.

## Что умеет (MVP)

- Подключить Kaspi-магазин по `X-Auth-Token` (шифруется Fernet-совместимо с Python)
- Синхронизация заказов за любой период (chunked, по 3 дня за вызов, без Vercel timeout)
- Дашборд на один магазин: 10 аналитических разрезов (выручка, статусы, платежи, доставка, топ-города, топ-клиенты, кредит…)
- Basic Auth для всего UI и API (кроме `/api/health`)

## Локальный запуск

```bash
# 1. Установить зависимости
npm install

# 2. Сгенерировать JWT_SECRET_KEY (ОДИН раз, сохранить в password manager!)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# 3. Скопировать .env.example в .env.local, заполнить:
cp .env.example .env.local
# POSTGRES_URL=postgres://... (или DATABASE_URL для локального Postgres)
# JWT_SECRET_KEY=...
# NICHE_USER=almas
# NICHE_PASS=...

# 4. Применить миграции
npx drizzle-kit push

# 5. Запустить dev-server
npm run dev
```

Открыть http://localhost:3000 — Basic Auth по `NICHE_USER` / `NICHE_PASS`.

## Как добавить магазин

1. `/` → форма «Добавить магазин»
2. Название магазина + `X-Auth-Token` из Kaspi Merchant Cabinet → Настройки → API
3. Сабмит → токен проверяется через `GET /shop/api/v2/orders?page[size]=1`
4. Если OK — магазин сохраняется, токен шифруется Fernet-ключом из `PBKDF2(JWT_SECRET_KEY)`

## Как выполнить синхронизацию

1. Открыть `/stores/<id>`
2. Нажать «Синхронизировать (365 дней)»
3. UI полит `POST /api/kaspi/stores/<id>/sync` каждые ~500 мс
4. Каждый вызов обрабатывает **один 3-дневный чанк** (Vercel function < 60s)
5. После завершения — данные видны в дашборде

## Rotating `JWT_SECRET_KEY`

**ОСТОРОЖНО:** ротация = потеря всех зашифрованных токенов в БД.

Правильный процесс:

1. Выгрузить все токены клиентов в виде plain-text (через recovery с их стороны или резервной копии ключа)
2. Ротировать `JWT_SECRET_KEY` в Vercel env
3. Перешифровать все токены новым ключом
4. Бекапнуть новый ключ в password manager

Если в БД есть строки, которые нечем расшифровать — удалить и попросить клиентов заново подать токены через форму.

## Архитектура

```
Kaspi Merchant Cabinet
   │  (клиент генерирует X-Auth-Token)
   ▼
POST /api/kaspi/stores
   │  Fernet.encrypt(token) → kaspi_stores.encrypted_token
   ▼
POST /api/kaspi/stores/[id]/sync   ← polled by UI
   │  ← decrypt token
   │  → fetch 1 chunk (3 days) from Kaspi API
   │  → upsert into kaspi_orders
   │  → update kaspi_sync_state
   │  → return { progress, status, chunksDone }
   ▼
GET /api/kaspi/analytics/[storeId] ← 10 aggregates in parallel
   ▼
/stores/[id] dashboard (React)
```

## Ключевые файлы

- `lib/kaspi/fernet.ts` — AES-128-CBC + HMAC-SHA256 (Python Fernet compat)
- `lib/kaspi/client.ts` — HTTP client для Kaspi API
- `lib/kaspi/mapper.ts` — Kaspi JSON → DB row
- `lib/kaspi/sync.ts` — chunked sync stateful
- `lib/kaspi/aggregates.ts` — 10 SQL-агрегатов
- `lib/db/schema.ts` — 3 таблицы: stores, orders, sync_state

## Deploy на Vercel

```bash
vercel link --yes
# В Vercel dashboard: Storage → Create Database → Postgres → link
# Env vars (printf важен — echo добавляет \n):
printf "%s" "$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")" | vercel env add JWT_SECRET_KEY production
printf "%s" "almas" | vercel env add NICHE_USER production
printf "%s" "<password>" | vercel env add NICHE_PASS production
# (Повторить для preview и development)

# Применить миграцию к прод БД:
vercel env pull .env.production.local
POSTGRES_URL="$(grep POSTGRES_URL_NON_POOLING .env.production.local | cut -d= -f2-)" npx drizzle-kit push

git push origin main  # авто-деплой
```
