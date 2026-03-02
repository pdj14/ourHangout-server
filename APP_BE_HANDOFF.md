# Our Hangout Backend Handoff (for App Team)

작성일: 2026-03-02

## 1) 현재 BE 상태 요약

- 백엔드 서버는 Synology NAS에서 Docker Compose로 구동 중입니다.
- 외부 접근 확인 완료:
  - `GET http://wowjini0228.synology.me:7083/health` -> `{"success":true,...}`
- 아키텍처:
  - App <-> Backend
  - Backend <-> OpenClaw Provider (`mock` | `http` | `connector`)

## 2) 앱에서 사용할 Base URL

- 외부망 기준: `http://wowjini0228.synology.me:7083`
- 내부망/로컬 테스트는 별도 URL 사용 가능
- 앱 환경변수(또는 빌드 설정)로 Base URL 분리 권장

## 3) 인증(Auth) 구현 상태

- 구현 완료:
  - `POST /v1/auth/signup` (이메일 회원가입)
  - `POST /v1/auth/login` (이메일 로그인)
  - `POST /v1/auth/refresh` (토큰 갱신)
  - `POST /v1/auth/logout`, `POST /v1/auth/logout-all`
  - `GET /v1/auth/me`
  - `POST /v1/auth/google` (Google ID Token 기반 가입/로그인)
  - `POST /v1/auth/link/google` (기존 계정에 Google 연동)
- 토큰:
  - Access Token + Refresh Token 구조
  - 보호 API는 `Authorization: Bearer <accessToken>` 필요
- 주의:
  - Google 로그인은 BE에 `GOOGLE_CLIENT_ID` 설정 + 앱에서 Google ID Token 발급이 필요

## 4) 채팅/소셜 API 구현 상태

- 프로필:
  - `GET /v1/me`, `PATCH /v1/me`
- 친구:
  - `GET /v1/friends`
  - `GET /v1/friends/search`
  - `POST /v1/friends/requests`
  - `POST /v1/friends/requests/:requestId/accept`
  - `POST /v1/friends/requests/:requestId/reject`
- 방/메시지:
  - `GET /v1/rooms`
  - `POST /v1/rooms/direct`
  - `POST /v1/rooms/group`
  - `GET /v1/rooms/:roomId/messages`
  - `POST /v1/rooms/:roomId/messages`
  - `POST /v1/rooms/:roomId/read`
  - 메시지 타입: `text | image | video | system`
- 신고:
  - `POST /v1/rooms/:roomId/report`
  - `GET /v1/admin/reports` (parent 권한)

## 5) WebSocket 구현 상태

- 엔드포인트: `GET /v1/ws?token=<accessToken>`
- 서버 Push 이벤트:
  - `message.new`
  - `message.delivery`
  - `room.updated`
  - `room.unread.updated`
  - `friend.updated`
  - `report.received`
- 클라이언트 인바운드 명령:
  - `message.send`
  - `message.read`
  - `room.join`
  - `room.leave`

## 6) Bot/OpenClaw 연계 상태

- Bot 기능:
  - `GET /v1/bots`
  - `POST /v1/bots/:botId/rooms` (봇과 1:1 방 생성/조회)
- OpenClaw 모드:
  - `OPENCLAW_MODE=mock` (기본 검증용)
  - `OPENCLAW_MODE=http`
  - `OPENCLAW_MODE=connector` (Telegram 유사 허브/커넥터 모델)
- Connector 허브 WS:
  - `GET /v1/openclaw/connector/ws`
  - 상태 확인: `GET /v1/openclaw/connector/status`
- 그룹방 라우팅 규칙:
  - 일반 메시지는 봇으로 자동 전달하지 않음
  - `/bot`, `/claw`, `@bot` 멘션 등 명시 트리거 시에만 전달

## 7) 앱 연동 1차 권장 순서

1. Base URL 설정 및 `GET /health`, `GET /ready` 확인
2. 이메일 로그인(`POST /v1/auth/login`) + 토큰 저장
3. 방 목록(`GET /v1/rooms`) + 메시지 조회(`GET /v1/rooms/:roomId/messages`)
4. 메시지 전송(`POST /v1/rooms/:roomId/messages`) 확인
5. WebSocket 연결 후 실시간 이벤트 수신 확인
6. Bot 목록/봇방 생성 후 봇 대화 플로우 검증
7. Google 로그인 SDK 연동 후 `POST /v1/auth/google` 연결

## 8) 현재 가정/TODO (앱팀 공유 필요)

- 미디어 업로드 URL은 현재 `mock-storage.local` 기반 목업 URL 발급 구조입니다.
- 푸시 알림은 토큰 등록 API까지 구현되어 있으며, 실제 FCM 발송 워커는 후속 작업입니다.
- 외부 URL은 현재 HTTP로 동작 중이며, 운영 단계에서는 HTTPS 전환이 필요합니다.
- OpenClaw 실연동은 `connector` 모드 기준 커넥터 프로세스 연결이 필요합니다.

## 9) 참고 문서

- API 상세: `API_COLLECTION.md`
- 아키텍처: `ARCHITECTURE.md`
- OpenClaw Connector 프로토콜: `docs/OPENCLAW_CONNECTOR_PROTOCOL.md`
- 백엔드 필수 리스트: `CHAT_BACKEND_REQUIRED_LIST.md`
