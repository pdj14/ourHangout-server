# API Collection (MVP)

Base URL: `http://localhost:3000`

OpenAPI:

- Swagger UI: `GET /docs`
- OpenAPI JSON: `GET /documentation/json`

## 1) Health / Ops

### Health

```bash
curl -s http://localhost:3000/health
```

### Ready

```bash
curl -s http://localhost:3000/ready
```

### Metrics

```bash
curl -s http://localhost:3000/metrics
```

## 2) Auth

### Signup (email/password)

```bash
curl -s -X POST http://localhost:3000/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"newuser@ourhangout.local","password":"StrongPass123!","role":"user","displayName":"New User"}'
```

### Google login/signup (ID token)

```bash
curl -s -X POST http://localhost:3000/v1/auth/google \
  -H "Content-Type: application/json" \
  -d '{"idToken":"<GOOGLE_ID_TOKEN>","role":"user"}'
```

### Link Google to existing local account

```bash
curl -s -X POST http://localhost:3000/v1/auth/link/google \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"idToken":"<GOOGLE_ID_TOKEN>"}'
```

### Logout all sessions

```bash
curl -s -X POST http://localhost:3000/v1/auth/logout-all \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

### Change password

```bash
curl -s -X POST http://localhost:3000/v1/auth/change-password \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"currentPassword":"OldPass123!","newPassword":"NewPass123!"}'
```

### Update phone profile (E.164)

```bash
curl -s -X PUT http://localhost:3000/v1/auth/profile/phone \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"phone":"+821012345678"}'
```

### Login

```bash
curl -s -X POST http://localhost:3000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"parent@ourhangout.local","password":"Parent123!"}'
```

### Refresh

```bash
curl -s -X POST http://localhost:3000/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<REFRESH_TOKEN>"}'
```

### Me

```bash
curl -s http://localhost:3000/v1/auth/me \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

### Logout

```bash
curl -s -X POST http://localhost:3000/v1/auth/logout \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<REFRESH_TOKEN>"}'
```

## 3) Pairing

### Generate code

```bash
curl -s -X POST http://localhost:3000/v1/pairing/code \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"ttlSeconds":300,"relationshipType":"parent_child"}'
```

### Consume code

```bash
curl -s -X POST http://localhost:3000/v1/pairing/consume \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"code":"ABC123"}'
```

### List relationships

```bash
curl -s http://localhost:3000/v1/pairing/relationships \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

## 4) Bots (OurHangout in-app)

### List available bots

```bash
curl -s http://localhost:3000/v1/bots \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

### Create/get bot room

```bash
curl -s -X POST http://localhost:3000/v1/bots/<BOT_ID>/rooms \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

## 5) Chat

### Create/get direct room

```bash
curl -s -X POST http://localhost:3000/v1/chats/rooms/direct \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"peerUserId":"<OTHER_USER_UUID>"}'
```

### List rooms

```bash
curl -s http://localhost:3000/v1/chats/rooms \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

### Send message

```bash
curl -s -X POST http://localhost:3000/v1/chats/rooms/<ROOM_ID>/messages \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"content":"안녕"}'
```

### List messages

```bash
curl -s "http://localhost:3000/v1/chats/rooms/<ROOM_ID>/messages?limit=30" \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

### ACK message

```bash
curl -s -X POST http://localhost:3000/v1/chats/messages/<MESSAGE_ID>/ack \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

## 6) WebSocket

Endpoint:

- `ws://localhost:3000/v1/ws?token=<ACCESS_TOKEN>`

Example with `wscat`:

```bash
npx wscat -c "ws://localhost:3000/v1/ws?token=<ACCESS_TOKEN>"
```

Expected push events:

- `ws.connected`
- `chat.message`
- `chat.ack`

Manual ACK via websocket:

```json
{"type":"ack","messageId":"<MESSAGE_UUID>"}
```

## 7) OpenClaw test

### Provider ping

```bash
curl -s http://localhost:3000/v1/openclaw/ping \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

### Test message through provider

```bash
curl -s -X POST http://localhost:3000/v1/openclaw/test-message \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"content":"bridge test"}'
```

## 8) Minimal E2E scenario (mock mode, bot room)

1. `OPENCLAW_MODE=mock`
2. Login as user
3. Call `GET /v1/bots` and select bot id
4. Create/get room with `POST /v1/bots/:botId/rooms`
5. User opens websocket
6. User sends message in bot room
7. User receives `chat.message` + `chat.ack` (`delivered`)
8. Mock provider generates reply message routed back to user websocket

## 9) HTTP provider failure check

Set:

```env
OPENCLAW_MODE=http
OPENCLAW_BASE_URL=http://127.0.0.1:18888
```

If endpoint unavailable, backend logs contain provider error with retry attempts and final upstream error code.

## 10) Contact integration note

Contact sync is implemented as app-side permission + hashed contact upload to backend.
Current MVP supports both email-hash and phone-hash matching.

## 11) Contacts (hashed)

### Sync hashed contacts

```bash
curl -s -X POST http://localhost:3000/v1/contacts/sync \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "clearMissing": true,
    "contacts": [
      {
        "type": "email",
        "hash": "<sha256_lower_email_hex>",
        "label": "friend"
      }
    ]
  }'
```

### Get matching users

```bash
curl -s "http://localhost:3000/v1/contacts/matches?limit=30" \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

### Get contact sync status

```bash
curl -s http://localhost:3000/v1/contacts/status \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

Hash rule (client side):

- `email`: `sha256(lowercase(email))` -> 64-char hex
- `phone`: `sha256(normalized_e164_phone)` -> 64-char hex

Phone match prerequisite:

- Target account should set phone via `PUT /v1/auth/profile/phone` with normalized E.164 value.
