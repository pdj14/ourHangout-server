# OpenClaw Connector Protocol (Server Hub Model)

This backend supports Telegram-like hub architecture:

- App clients talk only to backend.
- OpenClaw-side connector talks to backend over websocket.
- Backend routes bot-targeted messages to connector.

## 1) Connector websocket endpoint

- `ws://<BE_HOST>:3000/v1/openclaw/connector/ws?token=<OPENCLAW_CONNECTOR_TOKEN>&connectorId=<id>&botKey=<bot_key>`

Query params:

- `token`: required shared secret (`OPENCLAW_CONNECTOR_TOKEN`)
- `connectorId`: optional stable connector id
- `botKey`: optional, repeatable (`botKey=a&botKey=b`)
- `botKeys`: optional CSV alternative (`botKeys=a,b`)

If no bot key is provided, connector is treated as wildcard.

## 2) Server -> connector

```json
{
  "event": "openclaw.request",
  "data": {
    "requestId": "req-...",
    "messageId": "m_...",
    "roomId": "r_...",
    "senderId": "u_...",
    "recipientId": "u_bot",
    "botKey": "openclaw-assistant",
    "content": "hello",
    "requestedAt": "2026-03-02T00:00:00.000Z"
  }
}
```

## 3) Connector -> server

Success:

```json
{
  "event": "openclaw.response",
  "data": {
    "requestId": "req-...",
    "ok": true,
    "providerMessageId": "p_123",
    "replyText": "Hi from OpenClaw",
    "raw": {}
  }
}
```

Failure:

```json
{
  "event": "openclaw.response",
  "data": {
    "requestId": "req-...",
    "ok": false,
    "error": "OpenClaw local API timeout"
  }
}
```

## 4) Optional connector control events

- connector -> server: `connector.hello` with bot key capabilities
- connector -> server: `connector.ping`
- server -> connector: `connector.pong`

## 5) Operational endpoints

- `GET /v1/openclaw/connector/status` (auth required)
- `GET /v1/openclaw/ping` (auth required)

## 6) Routing behavior

- Direct bot room: forwarded by default.
- Group room: forwarded only when explicit trigger exists (`/bot`, `/claw`, `/<bot_key>`, `@bot` mention).
