# OpenClaw Android Connector 빠른 시작 가이드

이 문서는 아래 전제를 기준으로 작성합니다.

- `ourHangout-server`는 NAS 또는 서버에서 실행 중
- `OurHangout` 앱은 사용자 Android 단말에 설치됨
- `OpenClaw`는 **별도 Android 단말**에서 실행됨
- OpenClaw 단말은 `Termux + Ubuntu(proot) + Node` 환경으로 운영

목표:

- OurHangout 앱에서 `OpenClaw Assistant` 봇과 대화
- 메시지가 backend를 거쳐 OpenClaw 단말로 전달
- OpenClaw 응답이 다시 채팅방으로 돌아오게 하기

## 1. 전체 구조

```mermaid
flowchart LR
  APP[OurHangout App]
  BE[ourHangout-server]
  BOT[OpenClaw Assistant]
  CONN[Android Connector Client]
  OC[OpenClaw Gateway]

  APP <--> BE
  BE <--> BOT
  BE <--> CONN
  CONN <--> OC
```

## 2. backend 준비

backend `.env`에 아래를 넣습니다.

```env
OPENCLAW_MODE=connector
OPENCLAW_CONNECTOR_TOKEN=replace-with-long-random-token
OPENCLAW_TIMEOUT_MS=10000
OPENCLAW_RETRY_COUNT=0
```

backend 반영:

```bash
cd /volume1/docker/ourhangout-backend
git pull origin main
docker compose up -d --build
```

상태 확인:

```bash
docker compose logs --tail=200 api
```

## 3. OpenClaw Android 단말 준비

### 3.1 Termux 설치

OpenClaw 단말에 Termux를 설치합니다.

### 3.2 Ubuntu(proot) 준비

예시:

```bash
pkg update && pkg upgrade -y
pkg install proot-distro git curl -y
proot-distro install ubuntu
proot-distro login ubuntu
```

### 3.3 Node 설치

Ubuntu 안에서:

```bash
apt update
apt install -y curl ca-certificates gnupg
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs
node -v
npm -v
```

OpenClaw 공식 권장 버전은 Node 22+입니다.

## 4. OpenClaw Gateway 실행 확인

### 4.1 Gateway 실행

OpenClaw 설치 방식에 따라 Gateway를 실행합니다.

예시:

```bash
openclaw gateway
```

### 4.2 로컬 Gateway UI 확인

같은 단말 안에서:

```bash
curl -I http://127.0.0.1:18789/
```

정상이라면 로컬 Gateway가 떠 있는 상태입니다.

## 5. OpenClaw HTTP API 활성화

connector는 OpenClaw 공식 `OpenResponses HTTP API`를 호출하도록 맞춰두는 것을 권장합니다.

기본 endpoint:

- `POST /v1/responses`

예시 설정:

```json5
{
  gateway: {
    auth: {
      mode: "token",
      token: "replace-with-local-openclaw-token"
    },
    http: {
      endpoints: {
        responses: { enabled: true }
      }
    }
  }
}
```

로컬 확인:

```bash
curl -X POST http://127.0.0.1:18789/v1/responses \
  -H "Authorization: Bearer replace-with-local-openclaw-token" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openclaw:main",
    "input": "ping"
  }'
```

여기서 응답이 오면 connector 연계가 가능합니다.

## 6. connector client 준비

우리 backend 저장소에는 sample connector가 있습니다.

파일:

- `src/scripts/openclawConnectorClient.ts`

이 스크립트는:

- backend websocket에 연결
- `openclaw.request` 수신
- 로컬 OpenClaw HTTP API 호출
- `openclaw.response`로 되돌림

## 7. connector 실행 방법

OpenClaw 단말의 Ubuntu/Node 환경에서 backend repo를 받거나 필요한 스크립트만 가져온 뒤 실행합니다.

예시:

```bash
export OPENCLAW_CONNECTOR_TOKEN=replace-with-long-random-token
export HUB_WS_URL=ws://<BE_HOST>:3000/v1/openclaw/connector/ws
export CONNECTOR_ID=openclaw-android-1
export CONNECTOR_BOT_KEYS=openclaw-assistant
export CONNECTOR_MODE=http
export OPENCLAW_LOCAL_BASE_URL=http://127.0.0.1:18789
export OPENCLAW_LOCAL_API_TOKEN=replace-with-local-openclaw-token
export OPENCLAW_LOCAL_MODEL=openclaw:main
export OPENCLAW_LOCAL_SESSION_SCOPE=room

npm run connector:dev
```

## 8. session scope 권장값

지원값:

- `room`
- `user`

권장:

- `room`

이유:

- OurHangout bot room은 room 단위로 대화 문맥을 가지는 게 자연스럽습니다
- 그룹 mention도 room 단위로 이어지는 게 이해하기 쉽습니다

## 9. OurHangout 앱에서 사용 방법

최신 앱에서는 채팅 탭 상단에 `도우미` 섹션이 보입니다.

흐름:

1. 채팅 탭 진입
2. `OpenClaw Assistant` 선택
3. bot room 열기
4. 메시지 전송
5. backend -> connector -> OpenClaw -> backend -> 앱 순서로 응답 수신

## 10. 동작 확인 체크리스트

### 10.1 backend

```bash
curl http://<BE_HOST>:3000/health
```

### 10.2 connector 상태

로그인된 사용자 토큰으로:

```bash
GET /v1/openclaw/connector/status
```

여기서 connector가 연결되어 보여야 합니다.

### 10.3 provider 상태

```bash
GET /v1/openclaw/ping
```

`connector` provider가 `ok: true`여야 합니다.

### 10.4 bot room

앱에서:

1. `OpenClaw Assistant` 방 열기
2. 질문 전송
3. 응답이 같은 방에 돌아오는지 확인

## 11. 장애 시 확인 포인트

### 11.1 connector가 안 붙는 경우

확인:

1. `OPENCLAW_CONNECTOR_TOKEN`이 backend와 동일한지
2. `HUB_WS_URL` 주소가 맞는지
3. NAS 방화벽/포트 접근이 되는지

### 11.2 OpenClaw 응답이 안 오는 경우

확인:

1. `curl http://127.0.0.1:18789/` 응답 여부
2. `/v1/responses` endpoint 활성화 여부
3. `OPENCLAW_LOCAL_API_TOKEN`이 맞는지
4. `OPENCLAW_LOCAL_MODEL` 값이 실제 설정과 맞는지

### 11.3 앱에는 봇방이 뜨지만 응답이 없는 경우

확인:

1. backend `OPENCLAW_MODE=connector`인지
2. `GET /v1/openclaw/connector/status`에서 connector가 online인지
3. backend 로그에서 `openclaw.request` / `openclaw.response`가 오가는지

## 12. 권장 초기값

초기 구현은 아래처럼 가는 것을 권장합니다.

- connector mode: `http`
- local base url: `http://127.0.0.1:18789`
- session scope: `room`
- timeout: `10s`
- retry: `0`
- UX: `OpenClaw Assistant` 전용 bot room부터 시작

## 13. 다음 단계

이 문서 기준으로 다음 순서가 가장 안전합니다.

1. OpenClaw 단말에서 Gateway + `/v1/responses` 확인
2. connector client 연결
3. backend connector status 확인
4. OurHangout 앱에서 bot room 테스트
5. 이후 그룹방 `/claw`, `@assistant` 확장
