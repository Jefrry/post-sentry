# Post Sentry

Post Sentry is a Telegram bot that monitors public Telegram channels for new posts. Users add a channel, specify keywords, and choose a check interval of 1, 3, 6, 12, or 24 hours. The bot forwards matching posts. If Telegram blocks forwarding, the bot sends a notification with a link to the post.

The MVP supports public broadcast channels with an `@username`. Private channels, invite links, groups, and discussions are unsupported.

## How the bot works

The bot uses two independent Telegram APIs.

- Telegraf 4 uses the Bot API to handle `/start`, inline button callbacks, and messages in the bot conversation. It sends notifications and attempts to forward matching posts.
- GramJS uses MTProto with a single server-side user session to resolve public channels by username and read their history. The Bot API alone cannot reliably read the history of arbitrary public channels.

Prisma stores persistent data in SQLite. `UserStateManager` keeps conversation state in memory, so it resets when the bot restarts. The database stores `lastSeenMessageId`. When a user starts monitoring a channel, the bot sets the cursor to the latest post, so alerts start with new posts. After downtime, the bot catches up on all messages newer than the cursor. The `Delivery` table prevents duplicate delivery of matches the bot has already processed.

Run a single instance of the bot. The MVP uses SQLite, in-memory conversation state, and a local scheduler designed for one running process.

## Requirements

- Node.js 24 LTS
- pnpm 10.28.2 via Corepack
- A Telegram account for the single MTProto user session
- Docker Engine with Docker Compose v2 for containerized deployments

## Telegram setup

### Bot API

1. Open [@BotFather](https://t.me/BotFather).
2. Run `/newbot` and choose a name and username.
3. Save the token from BotFather as `BOT_TOKEN` in `.env`. Keep the token private and leave `.env` out of Git.

### MTProto API credentials and session

1. Sign in to [my.telegram.org](https://my.telegram.org/), open **API development tools**, and create an application.
2. Save `api_id` and `api_hash` as `TELEGRAM_API_ID` and `TELEGRAM_API_HASH` in your local `.env`.
3. Install the dependencies and start QR code authentication.

   ```bash
   corepack enable
   pnpm install --frozen-lockfile
   pnpm telegram:auth
   ```

4. In the Telegram mobile app, open **Settings → Devices → Link Desktop Device**, scan the QR code, and confirm the sign-in. If two-factor authentication is enabled, the script prompts you for your password.
5. Copy the printed `StringSession` into `TELEGRAM_SESSION` in `.env`. The session string grants access to the Telegram account. Treat it like a password and keep it out of chats, issues, and logs. If you use a shared terminal, clear its scrollback after saving the string.

Use a dedicated Telegram account with the minimum access needed. Follow the Telegram API Terms, respect rate limits, and observe the wait times indicated by `FLOOD_WAIT`.

## Configure `.env`

Create a local configuration file from the example.

```bash
cp .env.example .env
```

Fill in all fields.

```dotenv
BOT_TOKEN=
DATABASE_URL="file:./dev.db"
TELEGRAM_API_ID=
TELEGRAM_API_HASH=
TELEGRAM_SESSION=
SCHEDULER_POLL_MS=30000
CHECK_RETRY_MS=300000
```

`SCHEDULER_POLL_MS` controls how often the scheduler looks for checks that are due. `CHECK_RETRY_MS` sets the retry delay when a check fails. The bot stores timestamps in UTC and displays them in ISO 8601 format.

## Run locally for the first time

After filling in `.env`, run the following commands.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm prisma:generate
pnpm exec prisma migrate deploy
pnpm dev
```

`migrate deploy` applies pending migrations. To create a migration while developing schema changes, use `pnpm prisma:migrate`, which runs `prisma migrate dev` and is intended for development only.

Common commands:

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

To run the production build locally, use the following commands.

```bash
pnpm build
pnpm exec prisma migrate deploy
pnpm start
```

Before running `pnpm start`, stop any running `pnpm dev` process or container that shares the database and bot token.

## Docker Compose

The image uses a multi-stage build based on `node:24-bookworm-slim`. pnpm installs dependencies from the lockfile, then separate steps run `prisma generate` and compile TypeScript. The build then removes development dependencies. The runtime image contains the production dependencies, `dist`, the Prisma schema and migrations, and the entrypoint.

`prisma` is a production dependency because the entrypoint runs `prisma migrate deploy` each time the application starts. This command skips migrations that have already been applied. The Debian-based image also installs OpenSSL, which the Prisma engine requires.

To start the bot with a new named volume, run the following commands.

```bash
docker compose up -d --build
docker compose logs -f --tail=100 app
```

The entrypoint creates `/app/data/app.db`, applies migrations, and starts Node.js with `exec`. Both Bot API long polling and MTProto use outbound connections, so the container publishes no ports.

To stop the bot gracefully while keeping the volume, run:

```bash
docker compose stop
```

To remove the container and network while keeping the named volume, run:

```bash
docker compose down
```

Adding `-v` permanently deletes the database. After pulling a new version, update the deployment with the following commands.

```bash
docker compose down
docker compose up -d --build
docker compose logs -f --tail=100 app
```

The application has no HTTP endpoint or process-only health check. The process signals failure through its exit code, and `restart: unless-stopped` restarts it after a crash. To investigate a failure, run `docker compose logs`.

## SQLite and backups

With the example configuration, the local database is `prisma/dev.db`. The container stores its database at `/app/data/app.db` in the `post-sentry-data` named volume. The physical path depends on the Docker runtime. Run `docker volume inspect post-sentry-data` to view the volume metadata. Leave the Docker-managed `_data` directory untouched.

Stop the process that writes to the database before copying it to get a consistent backup. For a local backup, run the following commands.

```bash
mkdir -p backups
# Stop the dev or start process, then run:
cp prisma/dev.db backups/app.db
```

For a Docker backup, run the following commands.

```bash
mkdir -p backups
docker compose stop app
docker run --rm \
  --mount type=volume,src=post-sentry-data,dst=/data,readonly \
  --mount type=bind,src="$PWD/backups",dst=/backup \
  busybox:1.37.0 cp /data/app.db /backup/app.db
docker compose start app
```

Keep backups outside the named volume. Before restoring a backup, stop the application and save a separate copy of the current database.
