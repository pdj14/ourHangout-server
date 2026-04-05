# Pobi OpenClaw Pairing Flow Guide

## 1. 목적

이 문서는 포비(Pobi)를 사용자가 직접 OpenClaw 디바이스와 연결하는
최소 운영 흐름을 설명합니다.

핵심 원칙:

- 사용자에게는 `pairing code`만 보여준다
- 서버 내부 secret (`OPENCLAW_CONNECTOR_TOKEN`)은 사용자에게 숨긴다
- 라즈베리파이/OpenClaw는 pairing code로 등록한 뒤
  서버가 발급한 connector auth token으로 재연결한다

## 2. 현재 구현된 API

### 앱 사용자용

- `GET /v1/pobis/:pobiId/openclaw`
  - 현재 포비 OpenClaw 상태 조회
- `POST /v1/pobis/:pobiId/openclaw/pairings`
  - 1회용 연결 코드 발급

### 라즈베리파이/OpenClaw용

- `POST /v1/openclaw/connectors/register`
  - pairing code로 디바이스 등록
- `GET /v1/openclaw/connector/ws?token=...`
  - connector websocket 접속

## 3. 서버 준비

서버 `.env`:

```env
OPENCLAW_MODE=connector
OPENCLAW_CONNECTOR_TOKEN=replace-openclaw-connector-token
OPENCLAW_CONNECTOR_TOKEN_FILE=storage/openclaw/connector-token.txt
PUBLIC_BASE_URL=http://<SERVER_HOST>:3000
```

설명:

- `OPENCLAW_MODE=connector`
  - 라즈베리파이 쪽이 서버로 websocket 연결
- `OPENCLAW_CONNECTOR_TOKEN`
  - placeholder로 두면 서버가 자동 생성
- `OPENCLAW_CONNECTOR_TOKEN_FILE`
  - 자동 생성 token 저장 파일
- `PUBLIC_BASE_URL`
  - 앱/라즈베리파이가 접근 가능한 서버 주소

현재 token 확인:

```bash
cd C:/workspace/ourHangoutFamily/ourHangout-server
npm run connector:token
```

## 4. 앱 사용자 흐름

1. 앱에서 포비 프로필 열기
2. `OpenClaw 연결` 섹션 보기
3. `연결 코드 만들기` 누르기
4. 생성된 `연결 코드` 확인
5. 이 코드를 라즈베리파이/OpenClaw 화면에 입력

사용자에게 필요한 값:

- `pairing code`
- 필요 시 `botKey` 확인 가능

사용자에게 불필요한 값:

- `OPENCLAW_CONNECTOR_TOKEN`
- websocket token
- connector auth token

## 5. 라즈베리파이/OpenClaw 등록 흐름

라즈베리파이에서 필요한 입력:

- 서버 주소
- pairing code
- 장치 이름

등록 API 예:

```bash
curl -s -X POST http://<SERVER_HOST>:3000/v1/openclaw/connectors/register \
  -H "Content-Type: application/json" \
  -d '{
    "pairingCode":"7H2K9P",
    "connectorKey":"raspi-openclaw-1",
    "deviceName":"Living Room Pi",
    "platform":"linux"
  }'
```

응답 예:

```json
{
  "success": true,
  "data": {
    "connectorId": "raspi-openclaw-1",
    "ownerUserId": "uuid",
    "pobiId": "uuid",
    "botKey": "pobi-a1b2c3",
    "connectorAuthToken": "<LONG_SECRET>",
    "wsUrl": "ws://server:3000/v1/openclaw/connector/ws"
  }
}
```

이 응답에서 라즈베리파이가 저장할 값:

- `connectorId`
- `botKey`
- `connectorAuthToken`
- `wsUrl`

## 6. websocket 연결

라즈베리파이는 등록 응답을 저장한 뒤 websocket 연결:

```bash
CONNECTOR_AUTH_TOKEN=<connectorAuthToken> \
HUB_WS_URL=ws://<SERVER_HOST>:3000/v1/openclaw/connector/ws \
CONNECTOR_ID=raspi-openclaw-1 \
CONNECTOR_BOT_KEYS=pobi-a1b2c3 \
CONNECTOR_MODE=http \
OPENCLAW_LOCAL_BASE_URL=http://127.0.0.1:18888 \
npm run connector:dev
```

중요:

- 이제 일반 사용자는 `OPENCLAW_CONNECTOR_TOKEN`을 몰라도 된다
- pairing code 등록 후 받은 `connectorAuthToken`으로 연결 가능

## 7. openclawConnectorClient.ts 사용 방식

현재 connector 스크립트는 두 방식 모두 지원합니다.

### 기존 운영자 방식

```bash
OPENCLAW_CONNECTOR_TOKEN=<SERVER_SECRET> \
HUB_WS_URL=ws://<SERVER_HOST>:3000/v1/openclaw/connector/ws \
CONNECTOR_ID=my-device \
CONNECTOR_BOT_KEYS=pobi-a1b2c3 \
npm run connector:dev
```

### 사용자 pairing 방식

```bash
PAIRING_CODE=7H2K9P \
HUB_WS_URL=ws://<SERVER_HOST>:3000/v1/openclaw/connector/ws \
CONNECTOR_ID=raspi-openclaw-1 \
CONNECTOR_DEVICE_NAME="Living Room Pi" \
CONNECTOR_MODE=http \
OPENCLAW_LOCAL_BASE_URL=http://127.0.0.1:18888 \
npm run connector:dev
```

pairing 방식 동작:

1. pairing code로 `/v1/openclaw/connectors/register` 호출
2. 서버가 `connectorAuthToken` 반환
3. script가 그 token으로 websocket 연결

## 8. 상태 확인

### 서버

```bash
curl -s http://<SERVER_HOST>:3000/v1/openclaw/connector/status \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

### 앱

포비 프로필:

- 연결됨 / 연결 안 됨
- botKey
- pairing code (발급 시)

## 9. 지금 점검할 항목

1. 서버 `.env`에서 `OPENCLAW_MODE=connector`
2. 앱에서 포비 생성
3. 포비 프로필에서 `연결 코드 만들기`
4. 라즈베리파이에서 pairing code 등록
5. websocket 연결 성공
6. 앱 포비 프로필이 `연결됨`으로 변경
7. 포비와 1:1 메시지 전송
8. 응답 확인

## 10. 한 줄 정리

> 사용자는 pairing code만 다루고,
> 라즈베리파이/OpenClaw는 등록 후 발급된 connector auth token으로 서버에 재연결한다.
