# Synology NAS Deployment Guide (Container Manager)

## 1) Prepare files

1. Copy project folder to NAS, e.g. `/volume1/docker/ourhangout-backend`.
2. In that folder, duplicate `.env.example` as `.env`.
3. Update production values:
   - `JWT_SECRET` (long random)
   - `POSTGRES_PASSWORD`
   - `CORS_ORIGINS`
   - `OPENCLAW_MODE`, `OPENCLAW_BASE_URL`

## 2) Create project in Container Manager

1. Open **Container Manager**.
2. Go to **Project**.
3. Click **Create**.
4. Select **Use existing docker-compose.yml**.
5. Point to `/volume1/docker/ourhangout-backend/docker-compose.yml`.
6. Deploy.

## 3) Verify runtime

- Containers should be running:
  - `ourhangout-api`
  - `ourhangout-postgres`
  - `ourhangout-redis`
- Check API logs for migration execution on startup.

## 4) Post-deploy checks

```bash
curl -s http://<NAS_IP>:3000/health
curl -s http://<NAS_IP>:3000/ready
```

Open docs:

- `http://<NAS_IP>:3000/docs`

## 5) Volumes and backup points

- PostgreSQL persistent volume: `postgres_data`
- Redis persistent volume: `redis_data`

Backup recommendations:

1. Regularly dump PostgreSQL database from `ourhangout-postgres`.
2. Snapshot or backup Docker volumes at NAS level.
3. Keep `.env` backed up securely.

## 6) Update process

1. Upload updated backend source.
2. In Container Manager, rebuild/redeploy project.
3. Confirm migrations and `/ready` status.

## 7) Notes

- Compose startup command runs migration automatically before API start.
- For single-device validation, start with `OPENCLAW_MODE=mock`.
- Switch to `OPENCLAW_MODE=http` when real OpenClaw gateway is reachable from NAS network.
