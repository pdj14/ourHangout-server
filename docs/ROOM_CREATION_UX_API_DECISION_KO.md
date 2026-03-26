# Room Creation UX/API Decision

작성일: 2026-03-26
상태: Proposed
목표: 그룹방/가족방 생성 UX 와 API 구조를 최대한 단순하고 안정적으로 정리한다.

## 1. 결론

권장 방향은 아래다.

- UI 진입점은 하나로 둔다.
- 하지만 생성 타입은 숨기지 말고 명시적으로 선택하게 한다.
- API 는 `group` 과 `family` 를 별도 endpoint 로 계속 늘리지 말고, `shared room` 생성 API 하나로 통합한다.
- `direct room` 은 성격이 달라서 별도 endpoint 로 유지한다.

즉, 최종 방향은 아래처럼 정리하는 것이 가장 단순하고 안정적이다.

- `POST /v1/rooms/direct`
- `POST /v1/rooms` with `type = group | family`
- `POST /v1/rooms/:roomId/invitations`

## 2. UX 판단

## 2.1 "그룹방 만들기 안에서 가족방 체크"는 최선이 아님

가족방은 일반 그룹방의 색상/라벨 차이가 아니다.
아래 항목이 전부 달라진다.

- 멤버 의미
- 권한 모델
- 이후 기능
  - 위치
  - 일정
  - ToDo
  - 멤버별 호칭
- 초대 정책
- 장기 보존 성격

그래서 family 를 단순 체크박스로 묻는 방식은 위험하다.

- 사용자가 의미 차이를 놓치기 쉽다
- 잘못 생성했을 때 되돌리기 부담이 크다
- 권한과 후속 설정이 달라 UX 일관성이 깨진다

결론:

- 체크박스보다는 타입 선택이 맞다
- 단, "진입 버튼" 은 하나로 유지하는 것이 좋다

## 2.2 가장 단순한 생성 UX

권장 UX 는 아래 흐름이다.

### 진입

채팅 탭 `+` 버튼

### 첫 화면

`새 방 만들기`

- `일반 그룹`
  - 친구들과 바로 대화하는 방
- `가족방`
  - 가족 멤버 관리와 공유 기능이 붙는 방

이 단계는 체크박스가 아니라 2개의 카드나 segmented tab 이 적절하다.

이유:

- 사용자가 "무슨 방을 만들려는지" 먼저 결정하게 한다
- 타입 차이를 숨기지 않는다
- 화면은 여전히 한 군데다

## 2.3 타입별 생성 규칙

### 일반 그룹

권장:

- 방 이름 입력
- 멤버 선택
- 생성 즉시 입장

유저 인식:

- "바로 대화하러 만든다"

### 가족방

권장:

- 방 이름 입력
- 초기 멤버 선택은 선택 사항
- 생성 후 방 안에서 초대/권한/호칭 정리

유저 인식:

- "장기적으로 유지되는 가족 공간을 만든다"

즉, 가족방은 일반 그룹보다 "공간" 개념에 가깝다.

## 2.4 친구에서 가족으로 들어가는 UX

친구 액션에서 `가족에 초대` 를 눌렀을 때는 아래가 자연스럽다.

### 사용자가 family room 이 없는 경우

- `가족방이 없어요. 먼저 가족방을 만들까요?`

### family room 이 1개인 경우

- 그 family room 에 바로 초대

### family room 이 여러 개인 경우

- 초대할 family room 선택
  - `우리 가족`
  - `외가 가족`
  - ...

이 방식이 지금의 "friend -> family upgrade request" 보다 UX 가 훨씬 자연스럽다.

## 3. API 판단

## 3.1 `/rooms/group` 과 `/rooms/family` 를 계속 분리하는 것은 장기적으로 비추천

현재처럼 아래 endpoint 를 따로 둘 수는 있다.

- `POST /v1/rooms/group`
- `POST /v1/rooms/family`

하지만 장기적으로는 아래 문제가 생긴다.

- payload shape 가 거의 같은데 route 만 늘어난다
- 앱에서 조건 분기 코드가 늘어난다
- future type 확장 시 endpoint 가 계속 늘어난다
  - `school`
  - `class`
  - `team`
- validation 과 permission 로직이 route 단에서 중복되기 쉽다

따라서 create endpoint 는 합치는 게 맞다.

## 3.2 권장 API 구조

### direct room

그대로 유지:

`POST /v1/rooms/direct`

이유:

- 1:1 은 `get-or-create` 성격
- `friendUserId` 기반
- 제목/멤버 목록 생성 방식이 shared room 과 다르다

### shared room create

권장:

`POST /v1/rooms`

예시:

```json
{
  "type": "group",
  "title": "주말 모임",
  "memberUserIds": ["u2", "u3"]
}
```

```json
{
  "type": "family",
  "title": "우리 가족",
  "memberUserIds": ["u2"]
}
```

권장 validation:

- `type = group`
  - creator 포함 총 2명 이상
- `type = family`
  - creator 단독 생성 허용 가능
  - 초깃값으로 멤버를 넣는 것도 허용
  - 멤버는 friend 기반만 허용

### shared room invitations

권장:

`POST /v1/rooms/:roomId/invitations`

예시:

```json
{
  "targetUserId": "u3"
}
```

이 endpoint 는 room type 에 따라 다르게 동작하면 된다.

- group: 일반 초대
- family: 가족방 초대

즉, route 는 공통이고 policy 만 달라진다.

### invitation accept/reject

권장:

- `POST /v1/room-invitations/:invitationId/accept`
- `POST /v1/room-invitations/:invitationId/reject`

legacy family 전환 기간 동안은 아래를 compatibility layer 로 유지 가능:

- `/v1/family/upgrade-requests/*`

## 3.3 왜 이게 안정적인가

이 구조는 아래 장점이 있다.

- direct 와 shared 의 경계가 명확하다
- shared room 생성 API 는 하나라서 앱 코드가 단순하다
- 타입 추가 시 route 추가가 필요 없다
- validation 은 `type` switch 로 서비스 내부에서 통제 가능하다
- 권한/기능 확장이 room 단위로 자연스럽다

## 4. 권장 사용자 흐름

## 4.1 채팅 탭 `+`

보이는 선택지:

- `일반 그룹 만들기`
- `가족방 만들기`

## 4.2 일반 그룹 만들기

1. 이름 입력
2. 친구 선택
3. 생성

## 4.3 가족방 만들기

1. 이름 입력
2. 설명 문구 노출
   - 멤버별 호칭과 공유 권한은 방 안에서 설정
3. 초깃멤버 선택은 optional
4. 생성
5. 방 안에서 초대/권한 관리

## 4.4 친구 액션

친구 row 의 `가족에 초대`

1. 초대 대상 family room 선택
2. 초대 발송
3. 상대 수락
4. family room 멤버로 참가

이 흐름이면 "가족방 생성" 과 "가족 멤버 초대" 가 분리되어 훨씬 명확하다.

## 5. 구현 권장 순서

## 5.1 지금 바로 권장

### UI

- 채팅 탭 `+` 를 하나로 유지
- 현재 `그룹방 만들기` 모달을 `새 방 만들기` flow 로 교체
- 첫 단계에서 `일반 그룹` / `가족방` 선택

### API

- 내부 구현은 이미 `createGroupRoom`, `createFamilyRoom` 로 나뉘어 있어도 됨
- 외부 public API 는 점진적으로 `POST /v1/rooms` 로 통합

즉:

- 단기: route wrapper 허용
- 장기: public contract 통합

## 5.2 테스트 후 정리

안정화 후 아래 형태로 정리하는 것이 좋다.

- `POST /v1/rooms/direct`
- `POST /v1/rooms`
- `POST /v1/rooms/:roomId/invitations`
- `POST /v1/room-invitations/:invitationId/accept`
- `POST /v1/room-invitations/:invitationId/reject`

legacy endpoint:

- `/v1/rooms/group`
- `/v1/rooms/family`
- `/v1/family/upgrade-requests/*`

는 compatibility 용으로만 남기고 제거 수순을 밟는다.

## 6. 최종 권고

질문에 대한 직접 답은 아래다.

- "그룹방 만들 때 가족방인지 체크해야 하나?"
  - 예, 타입 선택은 필요하다
  - 하지만 작은 체크박스 형태는 비추천이다

- "API 를 따로 분리하는 게 맞나?"
  - 장기적으로는 아니라고 본다
  - `group` 과 `family` 는 shared room create API 하나로 합치는 편이 더 단순하고 안정적이다

가장 좋은 조합은 아래다.

- UI: `새 방 만들기` 한 진입점 + 타입 선택
- API: `direct` 는 별도, `shared room` 은 통합

이 조합이 UX 와 시스템 복잡도 둘 다 가장 낮다.
