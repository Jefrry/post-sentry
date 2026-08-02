# Post Sentry

Post Sentry — Telegram-бот для мониторинга новых публикаций в публичных Telegram-каналах. Пользователь добавляет канал, задаёт ключевые слова и интервал 1/3/6/12/24 часа. Бот пересылает совпавшие публикации, а если Telegram запрещает forwarding, отправляет уведомление со ссылкой.

MVP поддерживает только публичные broadcast-каналы с `@username`. Приватные каналы, invite links, группы и обсуждения не поддерживаются.

## Как устроен бот

Для продукта нужны два независимых Telegram API:

- Telegraf 4 работает через Bot API: принимает `/start`, inline callbacks и сообщения диалога, отправляет уведомления и пытается переслать найденные посты.
- GramJS работает через MTProto от одной серверной user session: разрешает произвольные публичные каналы и читает их историю. Bot API сам по себе не даёт надёжно читать историю любого публичного канала.

Постоянные данные хранятся в SQLite через Prisma. Диалоговый state находится в памяти `UserStateManager` и после перезапуска сбрасывается. `lastSeenMessageId` хранится в БД: при создании отслеживания курсор ставится на текущий последний пост, поэтому история не рассылается; после простоя сервис дочитывает все сообщения новее курсора. Таблица `Delivery` защищает от повторной доставки уже обработанного совпадения.

Процесс должен быть только один. SQLite, in-memory state и локальный scheduler этого MVP не рассчитаны на несколько одновременных экземпляров.

## Требования

- Node.js 24 LTS;
- pnpm 10.28.2 через Corepack;
- Telegram-аккаунт для единственной MTProto user session;
- Docker Engine с Docker Compose v2 — только для контейнерного запуска.

## Подготовка Telegram

### Bot API

1. Откройте [@BotFather](https://t.me/BotFather).
2. Выполните `/newbot`, задайте имя и username.
3. Сохраните выданный token в `BOT_TOKEN` файла `.env`. Не публикуйте token и не добавляйте `.env` в Git.

### MTProto api_id, api_hash и session

1. Войдите на [my.telegram.org](https://my.telegram.org/), откройте **API development tools** и создайте приложение.
2. Сохраните `api_id` и `api_hash` как `TELEGRAM_API_ID` и `TELEGRAM_API_HASH` в локальном `.env`.
3. Установите зависимости и запустите QR-авторизацию:

   ```bash
   corepack enable
   pnpm install --frozen-lockfile
   pnpm telegram:auth
   ```

4. В мобильном Telegram откройте **Settings → Devices → Link Desktop Device**, отсканируйте QR и подтвердите вход. При включённой 2FA скрипт запросит пароль.
5. Скопируйте напечатанную `StringSession` в `TELEGRAM_SESSION` файла `.env`. Эта строка предоставляет доступ к Telegram-аккаунту: храните её как пароль, не отправляйте в чат, issue или логи. Если терминал общий, очистите его scrollback после сохранения.

Используйте отдельный Telegram-аккаунт с минимально необходимым доступом. Соблюдайте Telegram API Terms, не обходите rate limits и учитывайте `FLOOD_WAIT`.

## Настройка `.env`

Создайте локальный файл из безопасного шаблона:

```bash
cp .env.example .env
```

Заполните все поля:

```dotenv
BOT_TOKEN=
DATABASE_URL="file:./dev.db"
TELEGRAM_API_ID=
TELEGRAM_API_HASH=
TELEGRAM_SESSION=
SCHEDULER_POLL_MS=30000
CHECK_RETRY_MS=300000
```

`SCHEDULER_POLL_MS` — частота поиска наступивших проверок. `CHECK_RETRY_MS` — задержка повтора после ошибки одного отслеживания. Даты сохраняются как UTC и в интерфейсе выводятся в ISO 8601.

## Первый локальный запуск

После заполнения `.env` выполните:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm prisma:generate
pnpm exec prisma migrate deploy
pnpm dev
```

Команда `migrate deploy` применяет уже существующие миграции без создания новой. Для разработки новой схемы доступна `pnpm prisma:migrate`, которая запускает `prisma migrate dev` и не должна использоваться в production.

Обычные команды:

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
pnpm test
pnpm format
pnpm format:check
pnpm prisma:generate
pnpm prisma:studio
```

Для production-подобного локального запуска:

```bash
pnpm build
pnpm exec prisma migrate deploy
pnpm start
```

Не запускайте `pnpm start` одновременно с `pnpm dev` или контейнером на той же БД и с тем же bot token.

## Docker Compose

Образ использует multi-stage build на `node:24-bookworm-slim`. Сначала pnpm устанавливает зависимости строго по lockfile, затем отдельно выполняются `prisma generate` и TypeScript build, после чего dev-зависимости удаляются. В runtime оставлены только production dependencies, `dist`, Prisma schema/migrations и entrypoint.

Пакет `prisma` намеренно находится в production dependencies: entrypoint выполняет `prisma migrate deploy` перед каждым запуском приложения. Это не `migrate dev`; уже применённые миграции пропускаются. Debian-образ также устанавливает OpenSSL, требуемый Prisma engine.

Первый запуск с новым named volume:

```bash
docker compose up -d --build
docker compose logs -f --tail=100 app
```

Entrypoint создаст `/app/data/app.db` и применит миграции, затем через `exec` запустит Node.js. Порты не публикуются: long polling Bot API и MTProto используют только исходящие соединения.

Корректная остановка с сохранением volume:

```bash
docker compose stop
```

Удаление контейнера и сети также сохраняет named volume:

```bash
docker compose down
```

Не добавляйте `-v`, если не хотите безвозвратно удалить БД. Обновление после получения новой версии:

```bash
docker compose down
docker compose up -d --build
docker compose logs -f --tail=100 app
```

В приложении нет HTTP endpoint, поэтому фиктивный healthcheck по наличию процесса не добавлен. Работоспособность определяется корректным exit code; `restart: unless-stopped` перезапускает аварийно завершившийся процесс. Смотрите причины в `docker compose logs`.

### Resource и security limits

Compose запускает один непривилегированный процесс с такими параметрами:

- `cpus: "0.50"`;
- hard memory limit `512m`, reservation `128m`;
- `pids_limit: 128`;
- V8 heap `--max-old-space-size=320`, оставляя память Prisma, GramJS и нативным библиотекам;
- read-only root filesystem и отдельный named volume только для `/app/data`;
- `tmpfs /tmp` не больше `64m`;
- `user: 1000:1000`, `cap_drop: [ALL]`, `no-new-privileges:true`;
- `init: true`, `restart: unless-stopped`, `stop_grace_period: 30s`.

Проверить применённые ограничения можно так:

```bash
docker inspect "$(docker compose ps -q app)" --format 'NanoCpus={{.HostConfig.NanoCpus}} Memory={{.HostConfig.Memory}} MemoryReservation={{.HostConfig.MemoryReservation}} PidsLimit={{.HostConfig.PidsLimit}} ReadonlyRootfs={{.HostConfig.ReadonlyRootfs}} CapDrop={{json .HostConfig.CapDrop}}'
```

При нехватке памяти процесс завершится, а restart policy запустит его снова. Признаки — повторяющийся startup в логах, рост restart count и `OOMKilled=true`:

```bash
docker inspect "$(docker compose ps -q app)" --format 'OOMKilled={{.State.OOMKilled}} RestartCount={{.RestartCount}}'
docker compose logs --tail=200 app
```

Меняйте `mem_limit`, `mem_reservation` и `NODE_OPTIONS` согласованно; V8 heap должен оставаться заметно ниже hard limit. CPU изменяется полем `cpus` в `compose.yaml`.

### Эквивалентный безопасный `docker run`

Сначала соберите образ и создайте volume:

```bash
docker build --target production -t post-sentry:local .
docker volume create post-sentry-data
```

Запуск без секретов в командной строке:

```bash
docker run -d \
  --name post-sentry \
  --env-file .env \
  --env DATABASE_URL=file:/app/data/app.db \
  --env NODE_ENV=production \
  --env NODE_OPTIONS=--max-old-space-size=320 \
  --mount type=volume,src=post-sentry-data,dst=/app/data \
  --user 1000:1000 \
  --cpus=0.5 \
  --memory=512m \
  --memory-reservation=128m \
  --pids-limit=128 \
  --read-only \
  --tmpfs /tmp:size=64m,mode=1777 \
  --cap-drop=ALL \
  --security-opt=no-new-privileges \
  --init \
  --restart=unless-stopped \
  --stop-timeout=30 \
  post-sentry:local
```

## SQLite и резервные копии

Локальная БД из шаблона находится в `prisma/dev.db`. Контейнерная БД — `/app/data/app.db` в named volume `post-sentry-data`. Физический путь зависит от Docker runtime; посмотреть метаданные можно командой `docker volume inspect post-sentry-data`. Не редактируйте Docker-managed `_data` вручную.

Для консистентной простой копии остановите единственный writer. Локально:

```bash
mkdir -p backups
# Остановите dev/start процесс, затем:
cp prisma/dev.db backups/app.db
```

Для Docker:

```bash
mkdir -p backups
docker compose stop app
docker run --rm \
  --mount type=volume,src=post-sentry-data,dst=/data,readonly \
  --mount type=bind,src="$PWD/backups",dst=/backup \
  busybox:1.37.0 cp /data/app.db /backup/app.db
docker compose start app
```

Храните резервные копии вне named volume. Перед восстановлением остановите приложение и сохраните отдельную копию текущей БД.

## Ограничения MVP

- Только публичные broadcast-каналы с username.
- Одна MTProto user session и ровно один процесс приложения.
- Диалог добавления хранится в памяти и после рестарта начинается заново.
- При protected content Bot API может запретить forward; бот отправит текст со ссылкой. Если пользователь заблокировал бота, даже fallback доставить невозможно, ошибка изолируется одним отслеживанием и будет повторена позже.
- SQLite подходит для одного небольшого MVP-процесса, но не для горизонтального масштабирования.
- Между успешной отправкой уведомления и записью `Delivery` остаётся небольшой crash window: при аварийном завершении в этот момент Telegram может получить повтор после рестарта. В штатной работе уникальная запись доставки и курсор предотвращают дубли.
- GramJS-пакет `telegram` зафиксирован требованиями проекта; следите за его security/maintenance status перед production-эксплуатацией.

## Ручной smoke checklist

Перед smoke-тестом используйте специально предоставленные тестовые credentials и тестовый Telegram-аккаунт. Не запускайте реального бота в CI без секретов.

- [ ] `/start` открывает главное inline-меню в private chat.
- [ ] Невалидная ссылка получает понятную ошибку и не меняет persistent data.
- [ ] Недоступный/private channel отклоняется.
- [ ] Пустые, слишком длинные и избыточные keywords отклоняются; дубли после нормализации сохраняются один раз.
- [ ] Каждый интервал 1/3/6/12/24 часа создаётся и отображается корректно; другой interval callback отклоняется.
- [ ] Повторное отслеживание того же канала одним пользователем не создаётся.
- [ ] Список, несколько страниц, подтверждение/отмена удаления и возврат на валидную страницу работают.
- [ ] Удалить можно только собственную запись; stale/чужой callback сообщает, что запись уже удалена или недоступна.
- [ ] Совпадение находится без учёта регистра и в обычном text.
- [ ] Совпадение находится в caption медиа-поста.
- [ ] Перезапуск между проверками дочитывает все сообщения после `lastSeenMessageId` без пропуска.
- [ ] Protected content приводит к fallback-уведомлению со ссылкой.
- [ ] Если пользователь заблокировал бота, ошибка одного tracking не останавливает последующие tracking.
- [ ] Первый контейнерный запуск с пустым volume применяет миграции и создаёт БД.
- [ ] Повторный контейнерный запуск сохраняет users/trackings/deliveries в named volume.
- [ ] `docker compose stop` завершает scheduler, Telegraf, GramJS и Prisma в пределах grace period; последующий `prisma migrate deploy` и запуск подтверждают целостность БД.

## Проверки перед релизом

```bash
pnpm format:check
pnpm lint
pnpm test
pnpm build
pnpm exec prisma validate
pnpm exec prisma generate
docker compose config --no-env-resolution --quiet
docker build --target production -t post-sentry:local .
```

Последняя Compose-команда намеренно использует `--no-env-resolution --quiet`: она проверяет модель без раскрытия значений из `.env`.
