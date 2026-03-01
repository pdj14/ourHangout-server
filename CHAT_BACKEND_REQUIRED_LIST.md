# Chat Backend Required List (Easy Guide)

## 1) Real-time messaging
- What: Use WebSocket for real-time push (`chat.message`, `chat.ack`).
- Why: Low-latency two-way communication for chat UX.
- Done when: Message send/receive and ACK work across two devices.

## 2) Message persistence
- What: Save every message to DB first, then push.
- Why: History recovery, offline sync, and auditability.
- Done when: Re-open app and old messages are loaded correctly.

## 3) Auth and session
- What: Signup/login, JWT access token, refresh token rotation.
- Why: Security and stable multi-device session lifecycle.
- Done when: Token expiry and refresh flow works without forced re-login.

## 4) Relationship model
- What: Pairing/friend/family relationship state.
- Why: Only allowed users should open direct chat rooms.
- Done when: Unauthorized users cannot create/read unrelated rooms.

## 5) Room and membership model
- What: 1:1 and (future) group room membership table/rules.
- Why: Message routing and permission checks depend on room membership.
- Done when: Room-based access checks are consistently enforced.

## 6) Offline delivery and sync
- What: Unread tracking, catch-up API, re-delivery logic.
- Why: Users are often offline or on unstable networks.
- Done when: Offline user reconnects and receives missed messages.

## 7) Push notifications
- What: FCM/APNs notification when receiver is offline.
- Why: Real usage requires background wake-up to bring users back.
- Done when: Offline device receives push and opens correct room.

## 8) Observability and operations
- What: Health/readiness, structured logs, metrics, alerts.
- Why: Fast diagnosis in production incidents.
- Done when: You can quickly detect and localize failures.

## 9) Security baseline
- What: CORS allow-list, rate limit, input validation, secrets in env.
- Why: Prevent abuse and injection-style failures.
- Done when: Security checks are active by default in all environments.

## 10) Migration/backup strategy
- What: DB migration scripts + backup/restore runbook.
- Why: Safe schema evolution and disaster recovery.
- Done when: Restore drill succeeds from backup snapshot.

## 11) Contact integration feasibility
- Possible: Yes.
- Current backend status: implemented (hashed sync + match API). Email and phone hash matching are supported.
- How it usually works:
  - Mobile app asks contact permission from user.
  - App sends hashed phone/email (never raw full address book) to backend.
  - Backend matches against registered users and returns safe suggestions.
- Why hashed matching: Privacy and compliance risk reduction.
- Must-have:
  - Explicit user consent flow
  - Data retention policy
  - Regional privacy compliance checks (e.g., GDPR/CCPA equivalents)

## 12) Google signup feasibility
- Possible: Yes, and now supported in this backend via Google ID token endpoint.
- Required:
  - Google OAuth client setup
  - `GOOGLE_CLIENT_ID` env configuration
  - Mobile app obtains Google ID token and sends it to backend

## 13) In-app bot integration (OpenClaw style)
- Possible: Yes, and now supported as an internal bot-room pattern.
- Current backend status:
  - `GET /v1/bots` to discover bot list
  - `POST /v1/bots/:botId/rooms` to create/get 1:1 bot room
  - only bot-targeted messages are bridged to OpenClaw provider
- Why needed:
  - App users talk to a bot identity like typical chat apps
  - OpenClaw coupling stays in backend adapter layer, not in mobile app
