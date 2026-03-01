# Architecture - Our Hangout Backend MVP

## 1) Layered structure

- **Interface Layer**
  - REST API (Fastify routes)
  - WebSocket endpoint (`/v1/ws`)
- **Application Layer**
  - `AuthService`, `PairingService`, `ChatService`, `ClawBridgeService`
- **Adapter Layer**
  - `ClawProvider` interface
  - `MockClawProvider`
  - `HttpClawProvider`
- **Infrastructure Layer**
  - PostgreSQL (`pg`)
  - Redis pub/sub (`ioredis`)
  - Docker Compose runtime

## 2) Key data flow

### A. Auth

1. App -> `POST /v1/auth/login`
2. Backend validates user/password
3. Backend issues access token + refresh token
4. Refresh token hash stored in PostgreSQL

### B. Chat send

1. App -> `POST /v1/chats/rooms/:roomId/messages`
2. Backend persists outbound message (`ack_status=sent`)
3. Backend publishes Redis event
4. Subscribed backend instance pushes to recipient socket
5. On socket delivery success, backend updates ACK to `delivered`

### C. OpenClaw bridge route

1. App message persisted by backend
2. Backend calls `ClawBridgeService.forwardMessage(...)`
3. Selected provider (`mock` or `http`) handles transport
4. Provider response (if `replyText`) is persisted as inbound message
5. Backend publishes/pushes inbound event via Redis + WebSocket

## 3) Security points

- JWT signing secret from env (`JWT_SECRET`)
- Access token verification for protected APIs
- Refresh token rotation + revocation table
- Rate limiting on requests
- CORS allow-list via `CORS_ORIGINS`
- Fastify JSON schema validation on body/params/query
- Helmet response headers
- Standardized error envelope with code

## 4) Multi-device / multi-instance strategy

Current MVP already includes Redis pub/sub event bus:

- Message events are published to Redis channel
- Any API instance can consume and push to its local WebSocket clients
- This enables horizontal API scaling without changing chat domain logic

Future extensions:

- Add Redis Streams / queue for durable delivery
- Add message read receipts (`read`) and per-device delivery state
- Add push notification adapter (FCM/APNs)

## 5) Database model (MVP)

- `users`
- `refresh_tokens`
- `pairing_codes`
- `chat_rooms`
- `messages`
- `schema_migrations`

Migration file: `db/migrations/001_init.sql`

## 6) Observability

- Structured logs (`pino`)
- Health endpoints: `/health`, `/ready`
- Minimal metrics endpoint: `/metrics`
  - `requestCount`
  - `errorCount`

## 7) Error standard

All errors are normalized:

```json
{
  "success": false,
  "error": {
    "code": "AUTH_UNAUTHORIZED",
    "message": "Authentication required.",
    "details": {}
  }
}
```

Main codes:

- `AUTH_UNAUTHORIZED`
- `AUTH_INVALID_CREDENTIALS`
- `AUTH_REFRESH_INVALID`
- `VALIDATION_ERROR`
- `FORBIDDEN`
- `RESOURCE_NOT_FOUND`
- `CONFLICT`
- `RATE_LIMITED`
- `OPENCLAW_TIMEOUT`
- `OPENCLAW_UPSTREAM_ERROR`
- `INTERNAL_ERROR`
