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

## 5-B) Social API (BACKEND_API_SPEC aligned)

### Me profile

```bash
curl -s http://localhost:3000/v1/me \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

```bash
curl -s -X PATCH http://localhost:3000/v1/me \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name":"Minji","status":"Happy today","avatarUri":"https://cdn.example/avatar.jpg"}'
```

### Avatar/media upload URL

```bash
curl -s -X POST http://localhost:3000/v1/me/avatar/upload-url \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"mimeType":"image/jpeg","size":230123}'
```

```bash
curl -s -X POST http://localhost:3000/v1/media/upload-url \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"kind":"image","mimeType":"image/jpeg","size":542312}'
```

```bash
curl -s -X POST http://localhost:3000/v1/media/complete \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"fileUrl":"https://mock-storage.local/media/2026/03/abc.jpg","kind":"image"}'
```

### Friends

```bash
curl -s "http://localhost:3000/v1/friends?limit=30" \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

```bash
curl -s "http://localhost:3000/v1/friends/search?q=child&limit=20" \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

```bash
curl -s -X POST http://localhost:3000/v1/friends/requests \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"targetUserId":"<TARGET_USER_ID>"}'
```

```bash
curl -s -X POST http://localhost:3000/v1/friends/requests/<REQUEST_ID>/accept \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

```bash
curl -s -X PATCH http://localhost:3000/v1/friends/<FRIEND_USER_ID> \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"trusted":true}'
```

### Rooms

```bash
curl -s "http://localhost:3000/v1/rooms?limit=30" \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

```bash
curl -s -X POST http://localhost:3000/v1/rooms/direct \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"friendUserId":"<FRIEND_USER_ID>"}'
```

```bash
curl -s -X POST http://localhost:3000/v1/rooms/group \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"title":"Class Friends","memberUserIds":["<USER_ID_1>","<USER_ID_2>"]}'
```

```bash
curl -s -X PATCH http://localhost:3000/v1/rooms/<ROOM_ID>/settings \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"favorite":true,"muted":false}'
```

```bash
curl -s -X POST http://localhost:3000/v1/rooms/<ROOM_ID>/leave \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

```bash
curl -s -X DELETE http://localhost:3000/v1/rooms/<ROOM_ID> \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

### Room messages + read

```bash
curl -s "http://localhost:3000/v1/rooms/<ROOM_ID>/messages?limit=50" \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

```bash
curl -s -X POST http://localhost:3000/v1/rooms/<ROOM_ID>/messages \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"clientMessageId":"c_001","kind":"text","text":"안녕!"}'
```

```bash
curl -s -X POST http://localhost:3000/v1/rooms/<ROOM_ID>/read \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"lastReadMessageId":"<MESSAGE_ID>"}'
```

### Report queue

```bash
curl -s -X POST http://localhost:3000/v1/rooms/<ROOM_ID>/report \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"reason":"abuse","messageId":"<MESSAGE_ID>"}'
```

```bash
curl -s "http://localhost:3000/v1/admin/reports?status=open&limit=30" \
  -H "Authorization: Bearer <GUARDIAN_ACCESS_TOKEN>"
```

```bash
curl -s -X PATCH http://localhost:3000/v1/admin/reports/<REPORT_ID> \
  -H "Authorization: Bearer <GUARDIAN_ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"status":"reviewed"}'
```

### Push token registration

```bash
curl -s -X POST http://localhost:3000/v1/push-tokens \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"platform":"android","pushToken":"<FCM_TOKEN>"}'
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
- `message.new`
- `message.delivery`
- `room.updated`
- `room.unread.updated`
- `friend.updated`

Manual ACK via websocket:

```json
{"type":"ack","messageId":"<MESSAGE_UUID>"}
```

WS social message send example:

```json
{"event":"message.send","data":{"roomId":"<ROOM_ID>","kind":"text","text":"hello","clientMessageId":"c_123"}}
```

WS social read example:

```json
{"event":"message.read","data":{"roomId":"<ROOM_ID>","lastReadMessageId":"<MESSAGE_ID>"}}
```

## 7) Contact integration note

Contact sync is implemented as app-side permission + hashed contact upload to backend.
Current MVP supports both email-hash and phone-hash matching.

## 8) Contacts (hashed)

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
