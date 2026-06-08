---
aliases: [развёртывание, deploy, установка, новый компьютер, setup]
tags: [инфраструктура, инструкция]
created: 2026-06-08
updated: 2026-06-08
---

# Развёртывание на новом компьютере

> Пошаговая инструкция как поднять radeya-analytics с нуля на новой машине (Windows / macOS / Linux).

## Содержание

### 0. Что обязательно перенести со старого компьютера

⚠️ **Критично — иначе потеряются данные:**

| Что | Зачем | Если потерять |
|---|---|---|
| `JWT_SECRET_KEY` (из `.env.local`) | Ключ шифрования токенов Kaspi | Все сохранённые магазины станут нечитаемыми — придётся добавлять заново |
| Дамп базы данных (опц.) | Все заказы, реклама, получатели TG | Начнёшь с пустой БД, загрузишь CSV заново |
| `TELEGRAM_BOT_TOKEN` | Бот для отчётов | Создать нового бота у @BotFather |

> Скопируй весь `.env.local` со старой машины — это самый простой способ сохранить все секреты.

---

### 1. Установить пререквизиты

| ПО | Версия | Где взять |
|---|---|---|
| **Node.js** | 24.x (LTS) | https://nodejs.org |
| **npm** | 11.x (идёт с Node) | — |
| **PostgreSQL** | 14+ | https://www.postgresql.org/download |
| **Git** | любая | https://git-scm.com |

Проверка после установки:
```bash
node --version   # v24.x
npm --version    # 11.x
psql --version   # 14+
git --version
```

---

### 2. Получить код

```bash
# Через git (если в репозитории):
git clone <url-репозитория> radeya-analytics
cd radeya-analytics

# Или просто скопировать папку проекта целиком со старого ПК.
```

---

### 3. Установить зависимости

```bash
npm install
```

> Next.js 16, React 19, Drizzle ORM, Recharts, Tailwind v4 — всё ставится автоматически из `package.json`.

---

### 4. Создать базу данных PostgreSQL

```bash
# Подключиться к Postgres (пароль задаётся при установке)
psql -U postgres

# Внутри psql создать БД:
CREATE DATABASE niche_analytics;
\q
```

> Имя БД исторически `niche_analytics` (проект переименован, но БД нет). Можно создать `radeya_analytics` — тогда поправь `DATABASE_URL` в шаге 5.

---

### 5. Настроить `.env.local`

```bash
# Скопировать шаблон
cp .env.example .env.local
```

Заполнить значения в `.env.local`:

```bash
# Подключение к локальной БД
DATABASE_URL=postgres://postgres:ПАРОЛЬ@localhost:5432/niche_analytics

# Ключ шифрования — ПЕРЕНЕСТИ СО СТАРОГО ПК!
# Если новая установка с нуля — сгенерировать:
#   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
JWT_SECRET_KEY=...

# Логин/пароль для входа в приложение (Basic Auth)
RADEYA_USER=renat
RADEYA_PASS=kapa1234

# Kaspi API (не меняется)
KASPI_API_BASE=https://kaspi.kz/shop/api/v2

# Телеграм-бот для отчётов (из @BotFather)
TELEGRAM_BOT_TOKEN=...

# AI-инсайты (опционально, без него /insights показывает заглушку)
ANTHROPIC_API_KEY=...
```

> `POSTGRES_URL` оставить **закомментированным** — он только для Vercel. Локально работает `DATABASE_URL`.

---

### 6. Применить схему БД (миграции)

```bash
npx dotenv-cli -e .env.local -- npx drizzle-kit push
```

> ⚠️ Просто `npx drizzle-kit push` **не сработает** — `drizzle.config.ts` читает `process.env`, а `.env.local` не подхватывается автоматически. Поэтому через `dotenv-cli`.
>
> Создаст все таблицы: `kaspi_stores`, `kaspi_orders`, `ad_campaigns`, `ad_weekly_stats`, `ad_products`, `ad_product_stats`, `ad_periods`, `ad_store_overview`, `tg_recipients` и др.

---

### 7. (Опционально) Перенести данные со старого ПК

Если нужны старые заказы/реклама:

```bash
# На СТАРОМ компьютере — выгрузить дамп:
pg_dump -U postgres niche_analytics > backup.sql

# На НОВОМ компьютере — залить:
psql -U postgres niche_analytics < backup.sql
```

---

### 8. Запустить

```bash
# Режим разработки (hot reload)
npm run dev
```

Открыть **http://localhost:3000** → ввести логин/пароль из `RADEYA_USER` / `RADEYA_PASS`.

**Продакшн-режим:**
```bash
npm run build
npm run start   # порт 3000
```

**Через PM2 (постоянная работа на сервере):**
```bash
npm run build
pm2 start npm --name "radeya-analytics" -- start
pm2 save
```

---

### Типичные ошибки

| Симптом | Причина | Решение |
|---|---|---|
| `ECONNRESET` / connection refused | БД не запущена или неверный `DATABASE_URL` | Проверить что Postgres работает, имя БД и пароль |
| `POSTGRES_URL or DATABASE_URL env var is required` | `.env.local` не заполнен | Заполнить `DATABASE_URL` |
| `drizzle-kit push` → `url: ''` | Запущен без `dotenv-cli` | Использовать `npx dotenv-cli -e .env.local -- npx drizzle-kit push` |
| Магазины не открываются, ошибка дешифровки | `JWT_SECRET_KEY` не совпадает со старым | Вернуть оригинальный ключ или пересоздать магазины |
| Telegram: `chat not found` | Получатель не написал боту | Каждый получатель должен 1 раз нажать «Старт» у бота |
| Telegram: `Unauthorized` | Неверный `TELEGRAM_BOT_TOKEN` | Проверить токен, перезапустить `npm run dev` |

---

## Связано с

- [[project]] — стек, архитектура, разделы UI
- [[decisions]] — почему локальный Postgres, почему Brain/
- [[rnp-feature]] — раздел рекламы (таблицы ad_*, отчёт в Telegram)

## Источник

- README.md проекта + опыт развёртывания, сессии 1–22, 2026-06-08
