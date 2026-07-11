# Our Hangout Backend (MVP)

Node.js + TypeScript backend for **Our Hangout**, designed for local validation first and Synology NAS Container Manager deployment.

## 1) What is implemented

- Separate backend project under `ourhangout-backend` (no app code modification)
- Fastify REST API + WebSocket real-time delivery
- PostgreSQL persistence + Redis pub/sub event bus
- JWT access/refresh token auth
- Email signup/login and Google ID token signup/login
- Hashed contact sync + contact-to-user matching API
- Pairing code (one-time consume)
- Relationship model (`friend` / `parent_child`) with auto room creation on pairing
- Account security endpoints (`change-password`, `logout-all`)
- 1:1 room create/list + message send/list + ACK (`sent`/`delivered`)
- Social API (spec-aligned) under `/v1`
  - profile (`GET/PATCH /me`)
  - friends + requests + trusted flag
  - direct/group rooms, room settings, leave/delete
  - message kinds (`text/image/video/system`) + cursor pagination
  - room read API (`POST /rooms/:roomId/read`) with `delivery=read`
  - media upload URL issue/complete
  - abuse report API + Guardian-only report queue
  - push token register/remove
- Basic operational endpoints
  - `/health`, `/ready`, `/metrics`
- OpenAPI docs (enabled by default only outside production)
  - `/docs` (UI), `/documentation/json` (JSON)
- Docker Compose for Synology compatibility (`api`, `postgres`, `redis`)

## 2) Quick start (local Node)

### 2.1 Prerequisites

- Node.js 22+ (Node.js 24 LTS recommended)
- PostgreSQL 16+
- Redis 7+

### 2.2 Setup

```bash
cd C:/workspace/ourHangoutFamily/ourHangout-server
cp .env.example .env
```

Adjust `.env` for local DB/Redis host if you run API outside Docker:

```env
DATABASE_URL=postgresql://ourhangout:ourhangout_dev_pw@localhost:5432/ourhangout
REDIS_URL=redis://localhost:6379
JWT_SECRET=<at-least-32-chars>
```

### 2.3 Install + migrate + seed + run

```bash
npm ci
npm run migration:preflight
npm run migrate
npm run seed
npm run dev
```

Server default: `http://localhost:3000`

## 3) Docker Compose run

### 3.1 Setup env

```bash
cd C:/workspace/ourHangoutFamily/ourHangout-server
cp .env.example .env
```

Default `.env.example` is Docker-network friendly (`postgres`, `redis` hostnames). Set a strong
`POSTGRES_PASSWORD` (at least 16 characters), matching URI-encoded credentials in `DATABASE_URL`, `JWT_SECRET`, and an externally
reachable `PUBLIC_BASE_URL` before production use. The production Compose file forces
`NODE_ENV=production`; the development file forces `NODE_ENV=development`.
The API runs the advisory-locked migrations before it starts listening.

### 3.2 Start stack

```bash
docker compose up -d --build
```

PostgreSQL and Redis are intentionally not exposed on host ports by default. Containers communicate over the internal Docker network.

### 3.3 Stop stack

```bash
docker compose down
```

### 3.4 One-command deploy scripts

For NAS or SSH-based deploys, these scripts pull the target branch, create required bind-mount directories, build images, run migrations, and recreate `api`. This works with both `docker compose` v2 and legacy `docker-compose` v1 on Synology.

Dev deploy (`main` + `docker-compose.dev.yml`):

```bash
bash scripts/deploy-dev.sh
```

Main deploy (`main` + `docker-compose.yml`):

```bash
bash scripts/deploy-main.sh
```

One-time conversion of an existing Synology main folder that was uploaded without `.git`:

```bash
sudo -i
curl -fsSL https://raw.githubusercontent.com/pdj14/ourHangout-server/main/scripts/bootstrap-main-git-deploy.sh -o /tmp/bootstrap-main-git-deploy.sh
sh /tmp/bootstrap-main-git-deploy.sh
```

The bootstrap script creates a PostgreSQL dump, clones `main` into a temporary directory,
preserves `.env`, `storage`, and `logs`, keeps the original folder as a timestamped backup,
then runs `deploy-main.sh` and verifies `/health` and `/ready`. Its default target is
`/volume1/docker/ourHangout-server`; override it with `TARGET_DIR=/volumeX/docker/<folder>` if needed.

If a legacy production `.env` still uses the development PostgreSQL password, rotate the
database role and matching Compose credentials before deployment:

```bash
sudo -i
curl -fsSL https://raw.githubusercontent.com/pdj14/ourHangout-server/main/scripts/rotate-compose-postgres-password.sh -o /tmp/rotate-compose-postgres-password.sh
sh /tmp/rotate-compose-postgres-password.sh
```

Notes:

- Script aborts if the git worktree is dirty.
- Script runs duplicate-data migration preflight before stopping the old API; resolve any reported rows using the audit document.
- If you really need to deploy with local changes, run `ALLOW_DIRTY=1 bash scripts/deploy-dev.sh` (or `deploy-main.sh`).
- On Synology, if `git` is installed outside the default `PATH`, rerun with `GIT_BIN=/usr/local/bin/git bash scripts/deploy-main.sh`.
- These deploy scripts require the project directory itself to be a real `git clone` with a `.git` directory.
- Required directories are created automatically: `logs`, `storage/media`, `storage/app-updates`.

## 4) Synology NAS deployment (Container Manager)

Detailed guide: `docs/SYNOLOGY_DEPLOY.md`

Short version:

1. Upload `ourhangout-backend` folder to NAS (e.g. `/volume1/docker/ourhangout-backend`).
2. Create `.env` from `.env.example` and set production secrets.
3. Open **Container Manager > Project > Create**.
4. Choose "Create `docker-compose.yml` from existing file" and select this project compose.
5. Deploy and verify `api`, `postgres`, `redis` containers all healthy.
6. Call `/health` and `/ready` from NAS IP + mapped port.

## 4.1) AWS deployment planning

Detailed guide: `docs/AWS_DEPLOY.md`

Use this when moving from NAS/single-node to managed cloud (ALB + ECS/EC2 + RDS + ElastiCache).

## 5) Environment variables

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | no | `development`/`production` |
| `PORT` | no | API port (container internal default `3000`) |
| `TRUST_PROXY` | no | `true/false`, proxy hops, or CSV list for Fastify `trustProxy` |
| `JWT_SECRET` | yes | JWT signing secret (>=32 chars) |
| `PUBLIC_BASE_URL` | production | Public origin used for media URLs and location callbacks; explicit non-loopback URL required in production |
| `MEDIA_STORAGE_DIR` | no | Local directory for uploaded media files (defaults to `storage/media`) |
| `MEDIA_USER_QUOTA_BYTES` | no | Per-user completed/pending media quota |
| `BINARY_BODY_LIMIT_BYTES` | no | Maximum media/APK upload body size |
| `BINARY_UPLOAD_CONCURRENCY` | no | Maximum in-flight buffered binary uploads per API process (default `2`) |
| `BINARY_UPLOAD_QUEUE_LIMIT` | no | Maximum requests waiting before binary body parsing (default `20`) |
| `BINARY_UPLOAD_QUEUE_TIMEOUT_MS` | no | Maximum wait for a binary upload slot (default `15000`) |
| `GOOGLE_CLIENT_ID` | no | Google OAuth client id (single audience, backward compatibility) |
| `GOOGLE_CLIENT_IDS` | no | Comma-separated Google OAuth client ids (recommended for app/web multi-audience) |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `MIGRATION_STATEMENT_TIMEOUT_MS` | no | Migration statement timeout; `0` disables it for long index builds |
| `MIGRATION_LOCK_TIMEOUT_MS` | no | Maximum wait for a migration DB lock (default `30000`) |
| `REDIS_URL` | yes | Redis connection string |
| `FCM_TIMEOUT_MS` | no | Per-request/token-acquisition FCM timeout |
| `FCM_SEND_BUDGET_MS` | no | Total time budget for one bounded FCM send operation |
| `CORS_ORIGINS` | yes | Comma-separated allowed origins |
| `RATE_LIMIT_MAX` | no | Rate limit max requests/window |
| `RATE_LIMIT_WINDOW` | no | Fastify rate-limit window |
| `RATE_LIMIT_REDIS_NAMESPACE` | no | Redis key prefix for distributed rate limiting |
| `RATE_LIMIT_SKIP_ON_ERROR` | no | Keep `false` in production so abuse protection does not fail open |
| `PAIRING_CODE_TTL_SECONDS` | no | Relationship pairing code TTL (default 300 seconds) |
| `ACCESS_TOKEN_TTL` | no | Access token lifetime |
| `REFRESH_TOKEN_TTL_DAYS` | no | Refresh token lifetime (days) |
| `GUARDIAN_CONSOLE_LOGIN_ID` | no | Fixed Guardian Console login id |
| `GUARDIAN_CONSOLE_PASSWORD` | no | Fixed Guardian Console password |
| `GUARDIAN_CONSOLE_ALLOW_LEGACY_PASSWORD` | no | Explicitly allow an existing 8-15 character Guardian password; keep `false` for new credentials |
| `GUARDIAN_CONSOLE_ACCESS_TOKEN_TTL` | no | Guardian Console access token lifetime |
| `LOG_LEVEL` | no | Pino log level |

Deployment note:
When using local media uploads, keep `MEDIA_STORAGE_DIR=storage/media` and preserve that path with a Docker volume bind such as `./storage/media:/app/storage/media`.

## 6) Verification checklist (MVP)

See `API_COLLECTION.md` for full commands.
See `CHAT_BACKEND_REQUIRED_LIST.md` for backend checklist and contact-integration notes.
See `docs/SERVER_AUDIT_2026-07-10_KO.md` for the latest security/performance audit, breaking changes, and deployment checklist.

- `GET /health` returns `success: true`
- `GET /ready` returns DB/Redis readiness
- login returns access + refresh token
- signup creates user and returns access + refresh token
- google token login/sign-up works when `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_IDS` is set
- guardian console login works with the configured fixed id/password
- hashed contact sync and user match lookup works (`/v1/contacts/*`)
- pairing consume creates relationship row and ensures direct room exists
- create direct room and send message
- websocket `/v1/ws?token=<accessToken>` receives `chat.message` and `chat.ack`
- websocket `/v1/ws?token=<accessToken>` also supports:
  - inbound commands: `message.send`, `message.read`
  - push events: `message.new`, `message.delivery`, `room.updated`, `room.unread.updated`, `friend.updated`

## 6.1) WSL E2E script

Run from WSL in project root:

```bash
cd /mnt/c/workspace/ourHangoutFamily/ourHangout-server
bash scripts/e2e-extended-wsl.sh
```

Notes:

- Script creates `.env` from `.env.example` if missing.
- It verifies pairing, contact matching, password rotation, and refresh-token revocation.

## 7) Default seed users

`npm run seed` is development-only and refuses to run with `NODE_ENV=production`. After running it locally:

- `parent@ourhangout.local` / `Parent123!`
- `child@ourhangout.local` / `Child123!`

## 8) Security defaults included

- JWT access/refresh lifecycle
- Rate limit (`@fastify/rate-limit`)
- CORS allow-list
- Input validation (Fastify JSON schema)
- Helmet headers
- Standardized error code envelope
- Secrets via `.env`

## 9) TODO / assumptions

- Message delivery in group chat is currently room-level simplified (`sent`/`delivered`/`read`) and not per-recipient state.
- No background job queue yet; long-running work should move to an external worker before horizontal scaling.
