# Our Hangout Backend Handoff (for App Team)

작성일: 2026-03-02

## 1) 현재 BE 상태 요약

- 백엔드 서버는 Synology NAS에서 Docker Compose로 구동 중입니다.
- 외부 접근 확인 완료:
  - `GET http://wowjini0228.synology.me:7083/health` -> `{"success":true,...}`
- 아키텍처: App <-> Backend

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
  - `GET /v1/admin/reports` (Guardian Console 전용)

## 5) WebSocket 구현 상태

- 엔드포인트: `GET /v1/ws?token=<accessToken>`
- 서버 Push 이벤트:
  - `message.new`
  - `message.delivery`
  - `room.updated`
  - `room.unread.updated`
  - `friend.updated`
- 클라이언트 인바운드 명령:
  - `message.send`
  - `message.read`
  - `room.join`
  - `room.leave`

## 6) 앱 연동 1차 권장 순서

1. Base URL 설정 및 `GET /health`, `GET /ready` 확인
2. 이메일 로그인(`POST /v1/auth/login`) + 토큰 저장
3. 방 목록(`GET /v1/rooms`) + 메시지 조회(`GET /v1/rooms/:roomId/messages`)
4. 메시지 전송(`POST /v1/rooms/:roomId/messages`) 확인
5. WebSocket 연결 후 실시간 이벤트 수신 확인
6. Google 로그인 SDK 연동 후 `POST /v1/auth/google` 연결

## 7) 현재 가정/TODO (앱팀 공유 필요)

- 미디어 업로드 URL은 현재 `mock-storage.local` 기반 목업 URL 발급 구조입니다.
- 푸시 알림은 토큰 등록 API까지 구현되어 있으며, 실제 FCM 발송 워커는 후속 작업입니다.
- 외부 URL은 현재 HTTP로 동작 중이며, 운영 단계에서는 HTTPS 전환이 필요합니다.

## 8) 참고 문서

- API 상세: `API_COLLECTION.md`
- 아키텍처: `ARCHITECTURE.md`
- 백엔드 필수 리스트: `CHAT_BACKEND_REQUIRED_LIST.md`
