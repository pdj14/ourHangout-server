# Our Hangout Backend (MVP)

Node.js + TypeScript backend for **Our Hangout**, designed for local validation first and Synology NAS Container Manager deployment.

## 1) What is implemented

- Separate backend project under `ourhangout-backend` (no app code modification)
- Fastify REST API + WebSocket real-time delivery
- PostgreSQL persistence + Redis pub/sub event bus
- JWT access/refresh token auth
- Pairing code (one-time consume)
- 1:1 room create/list + message send/list + ACK (`sent`/`delivered`)
- OpenClaw adapter abstraction
  - `MockClawProvider` (always available)
  - `HttpClawProvider` (`OPENCLAW_BASE_URL`)
- Basic operational endpoints
  - `/health`, `/ready`, `/metrics`
- OpenAPI docs
  - `/docs` (UI), `/documentation/json` (JSON)
- Docker Compose for Synology compatibility (`api`, `postgres`, `redis`)

## 2) Quick start (local Node)

### 2.1 Prerequisites

- Node.js 20+
- PostgreSQL 16+
- Redis 7+

### 2.2 Setup

```bash
cd C:/workspace/ourHome/ourhangout-backend
cp .env.example .env
```

Adjust `.env` for local DB/Redis host if you run API outside Docker:

```env
DATABASE_URL=postgresql://ourhangout:ourhangout_dev_pw@localhost:5432/ourhangout
REDIS_URL=redis://localhost:6379
JWT_SECRET=<at-least-32-chars>
OPENCLAW_MODE=mock
```

### 2.3 Install + migrate + seed + run

```bash
npm install
npm run migrate
npm run seed
npm run dev
```

Server default: `http://localhost:3000`

## 3) Docker Compose run

### 3.1 Setup env

```bash
cd C:/workspace/ourHome/ourhangout-backend
cp .env.example .env
```

Default `.env.example` is already Docker-network friendly (`postgres`, `redis` hostnames).

### 3.2 Start stack

```bash
docker compose up -d --build
```

### 3.3 Stop stack

```bash
docker compose down
```

## 4) Synology NAS deployment (Container Manager)

Detailed guide: `docs/SYNOLOGY_DEPLOY.md`

Short version:

1. Upload `ourhangout-backend` folder to NAS (e.g. `/volume1/docker/ourhangout-backend`).
2. Create `.env` from `.env.example` and set production secrets.
3. Open **Container Manager > Project > Create**.
4. Choose "Create `docker-compose.yml` from existing file" and select this project compose.
5. Deploy and verify `api`, `postgres`, `redis` containers all healthy.
6. Call `/health` and `/ready` from NAS IP + mapped port.

## 5) Environment variables

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | no | `development`/`production` |
| `PORT` | no | API port (container internal default `3000`) |
| `JWT_SECRET` | yes | JWT signing secret (>=32 chars) |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `REDIS_URL` | yes | Redis connection string |
| `CORS_ORIGINS` | yes | Comma-separated allowed origins |
| `OPENCLAW_MODE` | yes | `mock` or `http` |
| `OPENCLAW_BASE_URL` | yes (http mode) | OpenClaw gateway base URL |
| `OPENCLAW_TIMEOUT_MS` | no | OpenClaw HTTP timeout |
| `OPENCLAW_RETRY_COUNT` | no | OpenClaw retry count |
| `RATE_LIMIT_MAX` | no | Rate limit max requests/window |
| `RATE_LIMIT_WINDOW` | no | Fastify rate-limit window |
| `PAIRING_CODE_TTL_SECONDS` | no | Pairing code TTL |
| `ACCESS_TOKEN_TTL` | no | Access token lifetime |
| `REFRESH_TOKEN_TTL_DAYS` | no | Refresh token lifetime (days) |
| `LOG_LEVEL` | no | Pino log level |

`OPENCLAW_BASE_URL` note:
If API runs in Docker, `127.0.0.1` points to API container itself. Use a reachable host/IP from the container network.

## 6) Verification checklist (MVP)

See `API_COLLECTION.md` for full commands.

- `GET /health` returns `success: true`
- `GET /ready` returns DB/Redis readiness
- login returns access + refresh token
- create direct room and send message
- websocket `/v1/ws?token=<accessToken>` receives `chat.message` and `chat.ack`
- with `OPENCLAW_MODE=mock`, message round-trip includes mock reply
- with `OPENCLAW_MODE=http` and invalid base URL, upstream failure logs are explicit

## 6.1) WSL one-command E2E scripts

Run from WSL in project root:

```bash
cd /mnt/c/workspace/ourHome/ourhangout-backend
bash scripts/e2e-wsl.sh mock
```

HTTP provider failure check:

```bash
cd /mnt/c/workspace/ourHome/ourhangout-backend
bash scripts/e2e-wsl.sh http-error http://127.0.0.1:18888
```

Notes:

- Script creates `.env` from `.env.example` if missing.
- Script temporarily edits `.env` for selected mode and restores it automatically on exit.
- `http-error` mode expects a non-200 provider response and prints recent API logs.

## 7) Default seed users

After `npm run seed`:

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

- `HttpClawProvider` currently assumes OpenClaw endpoint `POST /v1/messages` and optional `replyText` in response.
- If OpenClaw contract differs, update only provider layer (`src/modules/openclaw`) without touching chat/auth modules.
- ACK stage is minimal (`sent`, `delivered`). `read` stage is not implemented yet.
- No background job queue yet; retry is in-process exponential backoff.
