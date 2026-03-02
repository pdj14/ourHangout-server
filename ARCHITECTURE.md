# Architecture - Our Hangout Backend MVP

## 1) Layered structure

- **Interface Layer**
  - REST API (Fastify routes)
  - WebSocket endpoint (`/v1/ws`)
- **Application Layer**
  - `AuthService`, `PairingService`, `ContactsService`, `BotService`, `ChatService`, `SocialService`, `ClawBridgeService`
- **Adapter Layer**
  - `ClawProvider` interface
  - `ConnectorClawProvider` (server hub + bot connector)
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

### A-2. Contact matching

1. App hashes contact identifiers on-device (`sha256(lowercase(email))`)
2. App -> `POST /v1/contacts/sync`
3. Backend stores only hashes (`contact_hashes` table)
4. App -> `GET /v1/contacts/matches`
5. Backend returns matched registered users (email-hash match)

Phone-hash match is also supported when target users set `phone_e164`.

### B. Chat send

1. App -> `POST /v1/chats/rooms/:roomId/messages`
2. Backend persists outbound message (`ack_status=sent`)
3. Backend publishes Redis event
4. Subscribed backend instance pushes to recipient socket
5. On socket delivery success, backend updates ACK to `delivered`
6. If room peer is an in-app bot user, backend forwards message to OpenClaw bridge

### B-2. Social room send

1. App -> `POST /v1/rooms/:roomId/messages` (or WS `message.send`)
2. Backend persists `room_messages` and updates `rooms.updated_at`
3. Backend pushes `message.new` to active sockets
4. Backend updates delivery to `delivered`/`read` on websocket delivery + read API
5. If active bot account participates in room, backend routes message to OpenClaw bridge and persists reply

### C. OpenClaw bridge route

1. User calls `GET /v1/bots` and `POST /v1/bots/:botId/rooms`
2. Bot room is backed by a dedicated bot user account (`bots.user_id`)
3. User message in bot room is persisted, ACKed, then bridged via `ClawBridgeService.forwardMessage(...)`
4. Selected provider (`connector`, `mock`, or `http`) handles transport
5. Provider response (if `replyText`) is persisted as inbound bot message
6. Backend publishes/pushes inbound event via Redis + WebSocket

### C-2. Connector hub flow (Telegram-like)

1. OpenClaw-side connector opens WS to `GET /v1/openclaw/connector/ws`
2. Connector authenticates with shared token (`OPENCLAW_CONNECTOR_TOKEN`) and declares supported bot keys
3. Backend hub routes bot-targeted message as `openclaw.request` to connector
4. Connector calls local OpenClaw engine and replies with `openclaw.response`
5. Backend resolves request and writes bot response to room

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

Current social room events are delivered through `ConnectionManager` directly (single-node ready).
For multi-instance social event fanout, extend social events onto Redis event bus similarly to `ChatService`.

Connector hub is in-memory per API instance.
For multi-instance deployment, route connector to a sticky instance or externalize hub state/broker.

Future extensions:

- Add Redis Streams / queue for durable delivery
- Add message read receipts (`read`) and per-device delivery state
- Add push notification adapter (FCM/APNs)

## 5) Database model (MVP)

- `users`
- `refresh_tokens`
- `pairing_codes`
- `user_relationships`
- `chat_rooms`
- `messages`
- `friend_requests`
- `friendships`
- `rooms`
- `room_members`
- `room_user_settings`
- `room_messages`
- `media_assets`
- `reports`
- `device_tokens`
- `bots`
- `contact_hashes`
- `schema_migrations`

Migration files: `db/migrations/*.sql`

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
- `AUTH_PROVIDER_MISMATCH`
- `AUTH_GOOGLE_INVALID`
- `AUTH_GOOGLE_CONFIG`
- `VALIDATION_ERROR`
- `FORBIDDEN`
- `RESOURCE_NOT_FOUND`
- `CONFLICT`
- `RATE_LIMITED`
- `OPENCLAW_TIMEOUT`
- `OPENCLAW_UPSTREAM_ERROR`
- `INTERNAL_ERROR`
