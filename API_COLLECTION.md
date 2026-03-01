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
  -d '{"ttlSeconds":300}'
```

### Consume code

```bash
curl -s -X POST http://localhost:3000/v1/pairing/consume \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"code":"ABC123"}'
```

## 4) Chat

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

## 5) WebSocket

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

## 6) OpenClaw test

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

## 7) Minimal E2E scenario (mock mode)

1. `OPENCLAW_MODE=mock`
2. Login as parent and child
3. Parent creates direct room with child
4. Child opens websocket
5. Parent sends message
6. Child receives `chat.message`
7. Parent/child receive `chat.ack` (`delivered`)
8. Mock provider generates reply message routed back to websocket

## 8) HTTP provider failure check

Set:

```env
OPENCLAW_MODE=http
OPENCLAW_BASE_URL=http://127.0.0.1:18888
```

If endpoint unavailable, backend logs contain provider error with retry attempts and final upstream error code.
