# NoirSound Connect — Production Deployment & Rollout Runbook

Цей документ містить покрокову інструкцію безпечного розгортання оновлення **NoirSound Connect & Discord Rich Presence** на продакшен-середовищі `https://noirsound.co`.

---

## 1. Загальний огляд релізу

- **Компоненти, що розгортаються**:
  - Prisma міграція (`20260821120000_add_desktop_connect_presence`)
  - Fastify Backend API + WSS (`@fastify/websocket`, `/api/desktop-connect/*`)
  - Web Frontend (`/connect/desktop`, `UserSettingsForm.jsx`, `playerStore.js`)
  - Desktop Application (`NoirSound Connect.app` v0.1.0)
- **Feature Flag**: `NOIRSOUND_CONNECT_ENABLED=true` (за замовчуванням вимкнено до завершення міграції)
- **Discord Application ID**: `1540281435296895066`

---

## 2. Покроковий план розгортання (Rollout Checklist)

### Крок 1: Резервне копіювання бази даних (Backup PostgreSQL)
```bash
# Створення дампу бази даних перед застосуванням міграції
pg_dump -U $DB_USER -h $DB_HOST -d $DB_NAME -Fc -f "/backups/noirsound_pre_connect_$(date +%Y%m%d_%H%M%S).dump"
```

### Крок 2: Застосування міграції бази даних
```bash
cd backend
npx prisma migrate deploy
```
*Перевірка*: Переконатися, що таблиця `DesktopConnectionDevice` створена, а стовпці `discordPresenceEnabled`, `discordPresenceShowCover`, `discordPresenceShowTimer` додані до `User`.

### Крок 3: Розгортання та перезапуск Backend
```bash
# Збірка та оновлення контейнера / процесу бекенду
docker-compose build backend
docker-compose up -d backend
```

### Крок 4: Перевірка працездатності бекенду (Health Checks)
```bash
curl -f https://noirsound.co/api/health
curl -f https://noirsound.co/api/ready
```
*Очікування*: HTTP 200 OK на обох ендпоінтах.

### Крок 5: Увімкнення Feature Flag
Встановити у production `.env`:
```env
NOIRSOUND_CONNECT_ENABLED=true
```
Перезапустити бекенд для активації маршрутів.

### Крок 6: Розгортання Frontend
```bash
npm run build
# Оновлення вебсервера (Caddy / Nginx)
docker-compose up -d frontend
```

### Крок 7: Перевірка WSS проксі (Caddy Reverse Proxy)
Переконатися, що Caddy коректно виконує WebSocket Upgrade:
```bash
curl -i -N -H "Connection: Upgrade" \
     -H "Upgrade: websocket" \
     -H "Sec-WebSocket-Version: 13" \
     -H "Sec-WebSocket-Key: SGVsbG8sIHdvcmxkIQ==" \
     https://noirsound.co/api/desktop-connect/presence
```
*Очікування*: HTTP 101 Switching Protocols або 401 (Unauthorized при відсутності токена).

### Крок 8: Сполучення пристрою (Pair Desktop)
1. Запустити `NoirSound Connect.app` на macOS.
2. Скопіювати 8-значний код сполучення (наприклад `K7F4-M2QP`).
3. Відкрити `https://noirsound.co/connect/desktop?code=K7F4-M2QP`.
4. Натиснути **"Підключити"**.

### Крок 9: Перевірка відтворення реального треку
1. Зайти на `https://noirsound.co` і увімкнути будь-який трек.
2. Перевірити, що в `NoirSound Connect` статус змінився на "Зараз грає: [Назва треку]".

### Крок 10: Перевірка у Discord Desktop
1. Відкрити профіль користувача у Discord Desktop.
2. Перевірити активність:
   ```text
   Слухає NoirSound
   [Назва треку]
   [Виконавець • Альбом]
   [Таймер відтворення]
   ```
3. Поставити на паузу: через 10 секунд статус повинен зникнути (grace timer).
4. Зняти з паузи: статус миттєво повертається.

---

## 3. Інструкція відкату (Rollback Plan)

Якщо виникли критичні помилки під час або після розгортання:

### 1. Миттєве вимкнення функції через Feature Flag (без зупинки сервісу):
```env
NOIRSOUND_CONNECT_ENABLED=false
```
Перезапустити бекенд. Усі запити desktop-застосунку повертатимуть 503, а WSS закриватиметься чисто без впливу на основний функціонал сайту.

### 2. Відкат бекенду та фронтенду:
```bash
git checkout <previous-stable-tag>
npm run build
docker-compose up -d --build
```

### 3. Відкат міграції бази даних (якщо потрібно):
```sql
ALTER TABLE "User"
DROP COLUMN IF EXISTS "discordPresenceEnabled",
DROP COLUMN IF EXISTS "discordPresenceShowCover",
DROP COLUMN IF EXISTS "discordPresenceShowTimer";

DROP TABLE IF EXISTS "DesktopConnectionDevice" CASCADE;
```
