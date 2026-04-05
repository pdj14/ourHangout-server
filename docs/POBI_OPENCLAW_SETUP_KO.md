# Pobi + OpenClaw 실행/연결 가이드

## 1. 목적

이 문서는 OurHangout 앱의 `포비(Pobi)`를
OpenClaw와 실제로 연결해서 동작시키는 방법을 정리합니다.

대상:

- 서버 업데이트 후 직접 확인하려는 개발자/운영자
- OpenClaw 단말에서 포비별 채널을 추가하려는 사용자

## 2. 현재 구조 요약

현재 MVP는 아래 방식으로 동작합니다.

1. 앱에서 포비 생성
2. 포비마다 고유 `botKey` 생성
3. 앱에서 포비에게 메시지 전송
4. backend가 해당 `botKey`를 포함해 OpenClaw connector로 전달
5. connector가 로컬 OpenClaw `POST /v1/messages`에 `{ content, botKey }` 전송
6. OpenClaw가 응답
7. 앱에 포비 메시지로 저장/전달

즉:

- 포비마다 고유 채널 키는 `botKey`
- OpenClaw 쪽 채널/페르소나 구분도 `botKey` 기준으로 잡는 것이 가장 자연스럽습니다

## 3. 서버 쪽 준비

### 3.1 코드 업데이트

서버 브랜치:

- `feature/openclaw-connector`

### 3.2 마이그레이션

새로 추가된 마이그레이션:

- `db/migrations/020_pobis.sql`

실행:

```bash
cd C:/workspace/ourHangoutFamily/ourHangout-server
npm run migrate
```

주의:

- `.env`에 `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`가 있어야 합니다

### 3.3 서버 실행

```bash
cd C:/workspace/ourHangoutFamily/ourHangout-server
npm run dev
```

또는 배포 환경에서 기존 방식대로 재배포합니다.

## 4. 앱 쪽 확인 순서

1. 앱 실행
2. 친구 탭 진입
3. 친구 탭을 한 번 더 눌러 `포비` 모드로 전환
4. `친구 추가 > 포비`에서 포비 생성
5. 포비 프로필에서 아래 항목 확인
   - 이름
   - 상태메시지
   - 프로필 사진
   - OpenClaw 연결 정보
   - `botKey`
   - `WS`
   - `CONNECTOR_BOT_KEYS`

## 5. OpenClaw 쪽 연결

## 5.1 connector 방식

현재 추천 방식은 connector입니다.

OpenClaw 단말에서 connector를 실행할 때
포비의 `botKey`를 `CONNECTOR_BOT_KEYS`로 넣습니다.

예:

```bash
OPENCLAW_CONNECTOR_TOKEN=<SERVER_ENV_TOKEN> \
HUB_WS_URL=ws://<SERVER_HOST>:3000/v1/openclaw/connector/ws \
CONNECTOR_ID=my-openclaw-device-1 \
CONNECTOR_BOT_KEYS=pobi-xxxxxxxx \
CONNECTOR_MODE=http \
OPENCLAW_LOCAL_BASE_URL=http://127.0.0.1:18888 \
npm run connector:dev
```

중요:

- `CONNECTOR_BOT_KEYS`에 들어가는 값이 포비의 채널 키입니다
- 앱 포비 프로필 화면에서 이 값을 확인할 수 있습니다

## 5.2 여러 포비를 한 OpenClaw에 연결

한 OpenClaw 단말이 여러 포비를 처리하게 하려면
`CONNECTOR_BOT_KEYS`를 comma-separated list로 넣습니다.

예:

```bash
CONNECTOR_BOT_KEYS=pobi-alpha,pobi-bravo,pobi-charlie
```

이 경우 connector는 세 포비 모두 처리합니다.

## 5.3 OpenClaw 내부 채널 추가

현재 connector는 로컬 OpenClaw에 아래 형태로 요청합니다.

```json
{
  "content": "hello",
  "botKey": "pobi-xxxxxxxx"
}
```

따라서 OpenClaw 내부에서 채널/페르소나를 나눈다면
`botKey`를 채널 식별자로 쓰면 됩니다.

권장 규칙:

- 채널 키 = 포비 `botKey`
- 채널 이름 = 앱에서 사용자가 정한 포비 이름

예:

- 앱 포비 이름: `모모`
- 포비 `botKey`: `pobi-a1b2c3`
- OpenClaw 채널 이름: `모모`
- OpenClaw 채널 키: `pobi-a1b2c3`

## 5.4 OpenClaw가 `botKey`를 아직 지원하지 않는 경우

이 경우에도 MVP 확인은 가능합니다.

동작:

- connector는 계속 `botKey`를 보냄
- OpenClaw가 이를 무시하면 모든 포비가 같은 기본 응답 경로를 사용

즉:

- 포비 엔티티와 채널 분리는 앱/서버에서 먼저 확인 가능
- OpenClaw 측 채널 분리는 나중에 `botKey` 해석을 추가하면 됩니다

## 6. 연결 상태 확인

포비 프로필 화면에서 아래를 봅니다.

- `connected = true`
- 매칭된 connector id 존재

서버 진단 API로도 확인 가능합니다.

```bash
curl -s http://localhost:3000/v1/openclaw/connector/status \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

그리고 포비별로는 앱의 포비 프로필 화면에서
자기 `botKey`와 매칭된 connector가 있는지 확인하면 됩니다.

## 7. 그룹방 동작

1. 그룹방 진입
2. 멤버 관리
3. `내 포비 초대`
4. 포비가 room member로 참가
5. owner가 방을 나가면 해당 owner의 포비도 자동 퇴장

현재 권장 사용 방식:

- 그룹에서는 포비를 항상 조용하게 둡니다
- `@포비이름`, `/포비`, `/botKey` 같은 호출형 사용이 안전합니다

## 8. 지금 점검할 것

### 8.1 최소 확인

1. 포비 생성
2. 포비 프로필 수정
3. 포비와 1:1 대화
4. 포비를 그룹에 초대
5. `mock-openclaw` 또는 실제 응답 확인

### 8.2 실제 OpenClaw 확인

1. connector 실행
2. `CONNECTOR_BOT_KEYS=<포비 botKey>` 설정
3. 앱에서 포비 프로필 연결 상태 확인
4. 포비에게 1:1 메시지 전송
5. 응답 확인

## 9. 한 줄 요약

> OpenClaw에서 포비 채널을 추가할 때는
> 앱 포비 프로필에 보이는 `botKey`를 채널 키로 쓰면 됩니다.
