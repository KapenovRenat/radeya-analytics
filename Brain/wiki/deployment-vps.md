---
aliases: [vps, сервер, production deploy, ubuntu сервер, прод]
tags: [инфраструктура, инструкция, prod]
created: 2026-06-22
updated: 2026-06-22
---

# Развёртывание на VPS (Ubuntu)

> Боевое развёртывание radeya-analytics на VPS с Ubuntu 24.04. Реальная последовательность, проверенная на сервере Radeya.

## Содержание

### Параметры сервера (Radeya)

| | |
|---|---|
| IP | 194.238.42.140 |
| ОС | Ubuntu 24.04 LTS |
| Ресурсы | 1 CPU · 1 ГБ RAM · 20 ГБ диск |
| Пользователь | ubuntu |
| Доступ | SSH по паролю, порт 22 |

⚠️ **1 ГБ RAM мало для сборки Next.js** — обязателен swap-файл (см. шаг 2), иначе `npm run build` падает с `Killed`.

---

### Пройденные шаги

**1. Вход и обновление**
```bash
ssh ubuntu@194.238.42.140
sudo apt update && sudo apt upgrade -y
```

**2. Swap-файл (критично при 1 ГБ RAM)**
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h   # проверка: Swap 2.0Gi
```

**3. Node.js 24**
```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
node --version && npm --version
```

**4. PostgreSQL 16**
```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl status postgresql
```

**5. Создание БД и пользователя**
```bash
sudo -u postgres psql
```
```sql
CREATE DATABASE radeya_analytics;
CREATE USER radeya WITH ENCRYPTED PASSWORD 'ПАРОЛЬ_БД';
GRANT ALL PRIVILEGES ON DATABASE radeya_analytics TO radeya;
\c radeya_analytics
GRANT ALL ON SCHEMA public TO radeya;   -- обязательно для PG 15+
\q
```

**6. Код**
```bash
cd ~
git clone https://github.com/KapenovRenat/radeya-analytics.git
cd radeya-analytics
npm install
```

**7. Перенос данных с локальной машины**

На локальном ПК — дамп с флагами совместимости:
```bash
PGPASSWORD=kapa pg_dump -U postgres -h localhost --no-owner --no-privileges niche_analytics > backup.sql
```
> `--no-owner --no-privileges` важны: иначе дамп привязывается к локальному пользователю `postgres` и на сервере падает на правах.

Загрузка на сервер (новое локальное окно, не SSH):
```bash
scp "G:\Apps\niche-analytics\backup.sql" ubuntu@194.238.42.140:/home/ubuntu/radeya-analytics/
```

Восстановление на сервере (заливать под `radeya`, `-h localhost` обязателен — иначе peer-auth):
```bash
PGPASSWORD='ПАРОЛЬ_БД' psql -U radeya -h localhost radeya_analytics < ~/radeya-analytics/backup.sql
# проверка:
PGPASSWORD='ПАРОЛЬ_БД' psql -U radeya -h localhost radeya_analytics -c "SELECT count(*) FROM kaspi_orders;"
```

**8. Настройка `.env.local`**
```bash
nano .env.local
```
```bash
DATABASE_URL=postgres://radeya:ПАРОЛЬ_БД@localhost:5432/radeya_analytics
KASPI_API_BASE=https://kaspi.kz/shop/api/v2
JWT_SECRET_KEY=ZfzNet12Hemmdowj4hUagSBExAZD+fJbOVgWlNm+uFc=   # ДОЛЖЕН совпадать с локальным!
RADEYA_USER=renat
RADEYA_PASS=надёжный_пароль
TELEGRAM_BOT_TOKEN=8815152706:AAEqC2eKkXc61SRMb-9wmcFosH1LYC5ipyU
ANTHROPIC_API_KEY=sk-ant-...
```
> ⚠️ `JWT_SECRET_KEY` 1-в-1 как локально — иначе зашифрованные токены Kaspi из дампа не расшифруются.

**9. Проверка схемы**
```bash
npx dotenv-cli -e .env.local -- npx drizzle-kit push
# ожидаемо: "No changes detected" (схема уже в дампе)
```

**10. Сборка**
```bash
npm run build   # 3–8 мин на 1 CPU, swap страхует от OOM
```

**11. Запуск через PM2** *(шаг ещё не завершён в первой сессии)*
```bash
sudo npm install -g pm2
pm2 start npm --name "radeya-analytics" -- start
pm2 save
pm2 startup   # выполнить выведенную команду для автозапуска после ребута
curl -I http://localhost:3000   # ожидаемо: HTTP 401 (Basic Auth жив)
```

**12. Nginx reverse-proxy + SSL** *(ещё не сделано)*
- `sudo apt install -y nginx` → конфиг проксирует :3000, `client_max_body_size 20M` для CSV
- `sudo apt install -y certbot python3-certbot-nginx` → `certbot --nginx -d домен`

---

### Скрипт обновлений `npm run deploy`

Добавлен в `package.json`:
```json
"deploy": "git pull && npm install && npx dotenv-cli -e .env.local -- npx drizzle-kit push && npm run build && pm2 restart radeya-analytics"
```
Будущие обновления на сервере — одной командой:
```bash
cd ~/radeya-analytics && npm run deploy
```

---

### Важные нюансы (грабли)

| Грабли | Решение |
|---|---|
| Git Bash: `set PGPASSWORD=` не работает | использовать `PGPASSWORD=xxx команда` (синтаксис bash) |
| `pg_dump` → дамп не льётся на сервер (права) | флаги `--no-owner --no-privileges` |
| restore: `peer authentication failed` | добавить `-h localhost` (форсит парольную авторизацию) |
| `drizzle-kit push` → `url: ''` | только через `npx dotenv-cli -e .env.local -- npx drizzle-kit push` |
| `npm run build` → `Killed` | swap-файл (шаг 2) |
| `git pull` конфликтует с `backup.sql` | `backup.sql` убран из git (`git rm --cached`), добавлен в `.gitignore` |
| `backup.sql` содержит зашифрованные токены | НЕ коммитить, передавать только через scp |

---

## Связано с

- [[deployment]] — установка для локальной разработки (новый ПК)
- [[project]] — стек, архитектура
- [[decisions]] — почему локальный Postgres, структура секретов

## Источник

- Живое развёртывание на VPS Radeya, сессия 2026-06-22
