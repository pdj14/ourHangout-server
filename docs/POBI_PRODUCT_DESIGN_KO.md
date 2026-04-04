# Pobi 제품/구현 설계 문서

## 1. 문서 목적

이 문서는 기존 `OpenClaw Assistant` 공용 bot 개념을
`포비(Pobi)`라는 사용자 소유 AI 동료 개념으로 재정의하고,
실제 제품/백엔드/앱 구현 구조까지 구체화하기 위한 설계 문서입니다.

이 문서는 아래를 다룹니다.

- `포비`의 개념과 제품 언어
- 사용자 설정 흐름
- 1:1 채팅과 그룹 채팅 동작 규칙
- 데이터 모델과 API 초안
- 다중 포비 확장 방향
- 현재 bot 구조에서 포비 구조로 이행하는 단계

## 2. 포비 정의

### 2.1 이름

`포비(Pobi)`는 `Pocket Being`에서 가져온 서비스 고유명사입니다.

직역해서 `포켓 비서`로 좁게 해석하지 않고,
아래 의미를 가진 제품 내 고유 개념으로 사용합니다.

> 포비는 손안에 두고 다니는 나만의 작은 존재이자,
> OpenClaw와 연결되어 대화하고 함께 방에 들어갈 수 있는 개인 AI 동료이다.

### 2.2 포비가 아닌 것

- 포비는 `친구`가 아니다
- 포비는 모든 사용자가 공유하는 `공용 bot`이 아니다
- 포비는 단순 기능 토글도 아니다

### 2.3 포비가 맞는 것

- 포비는 `사용자 소유물`이다
- 포비는 `이름`을 가진다
- 포비는 `OpenClaw 환경`과 연결된다
- 포비는 `1:1 채팅 상대`가 될 수 있다
- 포비는 `그룹방 참가자`가 될 수 있다

## 3. 제품 핵심 원칙

1. 앱은 기본적으로 일반 메신저여야 한다
2. 포비는 메신저를 방해하지 않는 선택 기능이어야 한다
3. 각 사용자는 자기 포비를 소유해야 한다
4. 포비는 감정적 애착 대상이면서도 실용적 도우미가 되어야 한다
5. 그룹방에서 포비는 조용해야 하며, 호출형 반응이 기본이어야 한다
6. 포비의 존재와 OpenClaw 연결 상태는 분리해서 봐야 한다

## 4. 사용자 경험 요약

### 4.1 생성

사용자는 `친구 추가` 시트 안의 `포비` 탭에서 포비를 만든다.

흐름:

1. 포비 이름 입력
2. 포비 테마 선택
3. OpenClaw 연결 코드/QR 발급
4. OpenClaw 단말에서 pairing code 입력
5. 연결 완료 후 `내 포비와 대화 시작`

### 4.2 1:1 대화

사용자는 자기 포비와 별도의 direct room에서 대화할 수 있다.

예:

- `모모`
- `루나`
- `도담`

직접방은 사용자 입장에서 `내 포비와의 대화`처럼 보여야 한다.

### 4.3 그룹방

사용자는 자신이 속한 그룹방에 자기 포비를 초대할 수 있다.

중요 규칙:

- 자동 참가 금지
- 명시 초대만 허용
- 기본 반응은 호출형
- 소유자가 방을 나가면 포비도 같이 나감

## 5. 용어 정리

- `owner`: 포비 소유자
- `pobi`: 사용자 소유 AI 동료
- `connector`: OpenClaw가 실제 연결된 단말/세션
- `default pobi`: 대표 포비
- `room companion member`: 방에 참가한 포비

## 6. UX 상세

### 6.1 친구 추가 시트

현재 `친구 추가` 시트는 그대로 유지하되, 상단에 탭을 둡니다.

- `친구`
- `포비`

`친구` 탭:

- 기존 친구 검색/요청 UI 유지

`포비` 탭:

- 포비 이름 입력
- 테마 선택
- 연결 상태 표시
- `연결 코드 만들기`
- `내 포비와 대화 시작`

### 6.2 포비 탭 카피 예시

- 제목: `내 포비 만들기`
- 설명: `포비는 내 OpenClaw와 연결되는 나만의 작은 동료예요.`
- 상태:
  - `연결 안 됨`
  - `연결됨`
  - `오프라인`
- 버튼:
  - `연결 코드 만들기`
  - `다시 연결`
  - `대표 포비로 설정`
  - `대화 시작`

### 6.3 채팅 탭

메인 화면에서는 포비를 과하게 드러내지 않습니다.

권장:

- 연결 전: 포비 관련 UI 숨김
- 연결 후: direct room 목록에 자연스럽게 노출
- 필요하면 상단 고정 섹션 없이도 충분

### 6.4 그룹방 UI

그룹방의 방 정보 또는 메뉴에 아래 액션을 둡니다.

- `내 포비 초대`
- `내 포비 내보내기`
- `이 방의 포비 보기`

입력창 근처에는 과한 노출 대신 가벼운 힌트만 둡니다.

예:

- `@모모 오늘 일정 정리해줘`
- `/포비 회의 요약해줘`

## 7. 그룹방 동작 규칙

### 7.1 참가 규칙

그룹방에는 사람과 포비가 함께 들어갈 수 있습니다.

예:

- 사용자 3명
- 각 사용자 포비 1개
- 총 참가 엔티티 6개

이는 허용 가능합니다.

다만 UI에서는 `6명`으로 뭉뚱그려 보이지 않게 해야 합니다.

권장 표시:

- `사람 3`
- `포비 3`

### 7.2 초대 규칙

- 포비는 owner가 직접 초대해야 한다
- 같은 사용자는 한 방에 포비 1개만 넣을 수 있다
- 다른 사람은 남의 포비를 임의로 초대할 수 없다

### 7.3 퇴장 규칙

- owner가 방을 나가면 해당 owner의 포비도 자동 퇴장
- owner가 강퇴되면 해당 owner의 포비도 자동 퇴장
- 포비 단독 퇴장은 owner가 직접 가능

### 7.4 반응 규칙

기본값은 `호출형 반응`입니다.

허용 예:

- `@모모`
- `@루나`
- `/포비`
- `/모모`

기본적으로는 항상 대화에 끼어들지 않게 해야 합니다.

### 7.5 오프라인 규칙

OpenClaw 연결이 끊겼다고 포비를 방에서 자동 제거하면 안 됩니다.

권장:

- 포비는 계속 참가 상태 유지
- 상태만 `오프라인`
- 호출 시 시스템 메시지 안내

예:

- `지금은 모모가 오프라인이에요`
- `잠시 후 다시 불러 주세요`

## 8. 데이터 모델

## 8.1 핵심 방향

외부 UX는 `포비`로 보이게 하되,
내부 구현은 기존 `bot-backed user` 구조를 재사용하는 것이 현실적입니다.

즉:

- 사용자에게는 `포비`
- 내부 채팅 엔진에는 `bot user`

## 8.2 신규 테이블 제안

### `pobis`

```text
id UUID PK
owner_user_id UUID NOT NULL
bot_user_id UUID NOT NULL UNIQUE
display_name TEXT NOT NULL
theme TEXT NOT NULL DEFAULT 'seed'
description TEXT
status TEXT NOT NULL CHECK (status IN ('pending', 'online', 'offline', 'revoked'))
default_connector_id UUID
is_default BOOLEAN NOT NULL DEFAULT FALSE
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

설명:

- `owner_user_id`: 포비 소유자
- `bot_user_id`: 기존 메시지 파이프라인에 태울 내부 user account
- `display_name`: 사용자 지정 이름
- `theme`: 외형/말투/캐릭터 타입
- `default_connector_id`: 기본 OpenClaw 환경
- `is_default`: 대표 포비 여부

### `room_pobi_memberships` (선택)

초기에는 `room_members`만으로도 구현 가능하지만,
관리 메타데이터가 필요하면 별도 테이블을 둘 수 있습니다.

```text
room_id UUID NOT NULL
pobi_id UUID NOT NULL
owner_user_id UUID NOT NULL
joined_by_user_id UUID NOT NULL
reply_mode TEXT NOT NULL DEFAULT 'mentioned_only'
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
PRIMARY KEY (room_id, pobi_id)
```

### `openclaw_connectors`

기존 사용자 소유 connector 설계를 그대로 확장 사용합니다.

핵심 컬럼:

- `owner_user_id`
- `connector_key`
- `device_name`
- `status`
- `is_default`
- `last_seen_at`

## 8.3 테마

`theme`는 세계관/톤을 담당합니다.

예:

- `seed`
- `fairy`
- `pet`
- `sprite`
- `buddy`

중요:

- `theme`는 브랜딩/표현용
- 기능과 라우팅은 `theme`에 의존하지 않음

## 9. API 초안

### 9.1 포비 생성/조회

#### `GET /v1/pobis`

현재 사용자의 포비 목록 조회

응답 예시:

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "모모",
      "theme": "seed",
      "status": "online",
      "isDefault": true,
      "directRoomId": "uuid"
    }
  ]
}
```

#### `POST /v1/pobis`

포비 생성

요청 예시:

```json
{
  "name": "모모",
  "theme": "seed"
}
```

### 9.2 포비 설정

#### `PATCH /v1/pobis/:pobiId`

이름, 테마, 설명, 대표 여부 변경

#### `POST /v1/pobis/:pobiId/set-default`

대표 포비 지정

### 9.3 OpenClaw 연결

#### `POST /v1/pobis/:pobiId/pairings`

포비에 사용할 OpenClaw 연결 코드 발급

응답 예시:

```json
{
  "success": true,
  "data": {
    "pairingCode": "7H2K9P",
    "expiresAt": "2026-04-05T12:00:00.000Z"
  }
}
```

#### `POST /v1/openclaw/connectors/register`

기존 connector register 흐름을 확장해
등록된 connector를 특정 owner 또는 pobi에 매핑

### 9.4 direct room

#### `POST /v1/pobis/:pobiId/direct-room`

내 포비와의 1:1 방 생성/조회

### 9.5 그룹방 참가

#### `POST /v1/rooms/:roomId/pobis/:pobiId/join`

내 포비를 그룹방에 초대

규칙:

- owner 본인만 호출 가능
- 같은 owner의 다른 포비가 이미 있으면 충돌 반환

#### `DELETE /v1/rooms/:roomId/pobis/:pobiId`

그룹방에서 내 포비 제거

## 10. 메시지 라우팅

## 10.1 direct room

흐름:

1. 사용자가 자기 포비 direct room에 메시지 전송
2. backend가 해당 포비의 owner와 connector 매핑 확인
3. `ClawBridgeService.forwardMessage(...)` 호출
4. connector가 OpenClaw 호출
5. 포비 이름으로 응답 저장

## 10.2 group room

흐름:

1. 방 안에 active 포비 멤버 존재
2. 메시지가 특정 포비 호출 패턴과 일치
3. 해당 포비 owner의 connector 선택
4. 응답을 해당 포비 sender로 방에 삽입

## 10.3 중요 규칙

- 현재의 단순 `botKey` 기반 선택만으로는 부족함
- 라우팅 입력에는 최소한 아래가 필요함
  - `ownerUserId`
  - `pobiId`
  - `connectorId` 또는 `default_connector_id`

## 11. 현재 구조와의 연결

현재 시스템은 이미 아래 구조를 가지고 있습니다.

- bot user 기반 direct room
- bot participant 기반 group 반응
- connector/websocket 기반 OpenClaw bridge

따라서 1차 구현은 아래 방식이 가장 현실적입니다.

1. 내부적으로는 계속 `bots` 테이블과 `bot user`를 사용
2. 새 `pobis` 테이블이 bot record를 소유
3. 앱과 API에서는 `bot` 대신 `pobi` 용어만 노출
4. 이후 점진적으로 `public bot` 코드를 `owner-owned pobi`로 치환

## 12. 다중 포비 확장

## 12.1 결론

장기적으로는 한 사용자가 여러 포비를 가질 수 있게 하는 것이 맞습니다.

이유:

- 역할별 분리 가능
- 서로 다른 OpenClaw 환경과 연결 가능
- 캐릭터/테마 확장 가능
- 개인화 수준이 높아짐

## 12.2 하지만 MVP는 1개

권장 MVP:

- 사용자당 포비 1개
- 대표 포비 개념만 우선 도입
- 1:1 대화
- 그룹방 참가

## 12.3 다중 포비 단계에서의 규칙

- 사용자는 여러 포비를 가질 수 있다
- 대표 포비는 항상 1개만 가진다
- 빠른 1:1 대화는 대표 포비와 연결
- 그룹방에는 사용자당 포비 1개만 활성 참가 가능
- 여러 포비를 한 방에 동시에 넣는 기능은 2차 이후 검토

## 12.4 다중 포비의 UX

권장 화면:

- `포비 관리`
- 포비 카드 목록
- 각 카드에
  - 이름
  - 테마
  - 상태
  - 연결된 OpenClaw
  - 대표 포비 여부

## 13. 권장 MVP 범위

1. 사용자당 포비 1개
2. 이름 지정 가능
3. OpenClaw 연결 코드 발급
4. direct room 생성
5. 그룹방 `내 포비 초대`
6. owner 퇴장 시 포비 동반 퇴장
7. 호출형 반응만 허용

보류:

1. 사용자당 다중 포비
2. 방별 서로 다른 포비 동시 운영
3. 공유 포비
4. 포비 간 협업

## 14. 구현 우선순위

### 1단계

- `pobis` 스키마 추가
- 포비 생성/조회 API 추가
- 기존 bot room을 포비 direct room으로 감싸기

### 2단계

- connector ownership/pairing 추가
- 포비와 connector 연결
- direct room sender-owned routing 적용

### 3단계

- 그룹방 포비 초대 API 추가
- owner 퇴장 시 포비 자동 퇴장
- 호출형 반응 추가

### 4단계

- 다중 포비
- 대표 포비 전환
- 포비 관리 화면

## 15. 한 줄 요약

> 포비는 공용 bot이 아니라, 사용자가 소유하고 이름을 붙이며,
> OpenClaw와 연결해 1:1 대화와 그룹 참가까지 가능한 개인 AI 동료이다.
