# AWS Deployment Guide (Pragmatic Checklist)

## 1) Recommended target architecture

- Compute: `ECS Fargate` (recommended) or `EC2`
- API entry: `Application Load Balancer (ALB)` + `ACM` TLS cert
- Database: `RDS PostgreSQL`
- Cache/pubsub/rate-limit store: `ElastiCache Redis`
- DNS: `Route53`
- Secrets: `AWS Secrets Manager` or `SSM Parameter Store`
- Logs/metrics: `CloudWatch Logs + Alarms`

## 2) What is already prepared in backend code

- Fastify `trustProxy` is env-driven (`TRUST_PROXY`)
- Rate limit uses Redis store (distributed-safe)
- Migration execution separated from API boot in compose (`migrate` service)

This reduces common cloud issues around client IP handling, multi-instance throttling, and startup race conditions.

## 3) Minimum infra checklist

1. Create VPC with private subnets for API/DB/Redis.
2. Put ALB in public subnets, API tasks/instances in private subnets.
3. Allow SG flow:
   - ALB -> API `3000`
   - API -> RDS `5432`
   - API -> Redis `6379`
4. Configure RDS automated backups + retention.
5. Configure Redis snapshot policy.
6. Configure CloudWatch alarms (5xx, CPU, memory, DB connections).

## 4) Required env vars for AWS

- `NODE_ENV=production`
- `TRUST_PROXY=true`
- `DATABASE_URL=postgresql://...` (RDS endpoint)
- `REDIS_URL=redis://...` (ElastiCache endpoint)
- `JWT_SECRET=<strong random>`
- `CORS_ORIGINS=https://<app-domain>`
- `RATE_LIMIT_REDIS_NAMESPACE=ourhangout-rate-limit-`
- `OPENCLAW_MODE=mock|http`
- `OPENCLAW_BASE_URL=<reachable endpoint from AWS>`

## 5) Migration strategy in AWS

Do **not** run schema migration in every API replica.

Use one of:
- ECS one-off task: `node dist/scripts/migrate.js` before service rollout
- CI/CD pre-deploy step running migration once

After migration success, deploy API tasks.

## 6) OpenClaw connectivity warning

If OpenClaw lives in home/local network, AWS cannot usually call it directly.

Choose one:
1. Private network bridge (VPN/Tailscale/WireGuard) between AWS and device network
2. Device-outbound model (recommended): OpenClaw device opens secure outbound WebSocket/MQTT to backend

For long-term cloud operations, #2 is typically more stable than inbound access to home devices.

## 7) Cutover sequence

1. Deploy `staging` stack on AWS.
2. Run migrations once.
3. Run smoke/E2E scripts against staging.
4. Point test app build to staging domain.
5. Observe logs/metrics for at least 24h.
6. Roll out production and switch DNS.

## 8) Post-cutover hardening

1. Add WAF rules on ALB.
2. Add CI/CD gate running `npm run check`, build, and E2E.
3. Add DB restore drill schedule.
4. Add key rotation plan (`JWT_SECRET`, OAuth keys).
