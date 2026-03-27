# Family Room Relationship Design

작성일: 2026-03-27
상태: Proposed
목표: 친구 탭의 가족 연결 흐름을 없애고, 가족 관계는 family room 안에서만 관리한다.

## 1. 결정

- 친구 탭에서는 가족 관계를 만들지 않는다.
- 가족 관계의 source of truth 는 `family room` 이다.
- 멤버별 호칭은 enum 으로 제한하지 않고 자유 텍스트로 둔다.
- 정식 관계는 `guardian_child` 하나만 둔다.
- 보호자는 여러 명일 수 있다.
- 자녀도 여러 명일 수 있다.
- 자동으로 `부부`, `배우자`, `공동 양육자`를 생성하지 않는다.

## 2. 왜 이렇게 가야 하나

- 친구는 1:1 연결이고, 가족은 다자 구조다.
- 가족을 친구 탭에서 만들면 결국 2인 관계를 억지로 확장하게 된다.
- 실제 가족 구조는 `엄마 + 아빠 + 아이 여러 명`, `한 아이에 보호자 여러 명`, `한 보호자가 자녀 여러 명`, `외가/본가 분리` 같은 room 단위 컨텍스트가 필요하다.
- 호칭은 가족마다 다를 수 있다. 같은 사람도 어떤 방에서는 `엄마`, 어떤 방에서는 `이모`, 어떤 방에서는 `쌤`으로 불릴 수 있다.

## 3. 핵심 원칙

### 3.1 가족은 room 안에서만 관리

- 가족 초대, 멤버십, 권한, 관계 설정은 모두 family room 안에서 처리한다.
- 친구 탭은 친구 관리와 1:1 채팅 진입만 담당한다.

### 3.2 호칭은 자유 텍스트

- `mother`, `father` 같은 고정 enum 을 source of truth 로 두지 않는다.
- 각 멤버는 family room 안에서 자신이 보일 호칭을 자유롭게 입력한다.
- 예: `엄마`, `아빠`, `큰이모`, `할머니`, `삼촌`, `담임쌤`

### 3.3 정식 관계는 guardian_child 하나만

- 관계는 방향성이 있는 `guardian_child` 만 사용한다.
- `guardian -> child` 구조다.
- 한 child 에 guardian 여러 명 허용
- 한 guardian 에 child 여러 명 허용

### 3.4 자동 추론 금지

- `guardian_child` 두 개 이상이 있다고 해서 `부부`나 `공동양육자`를 자동 저장하지 않는다.
- 필요하면 UI 에서 `같은 자녀를 돌보는 보호자` 정도의 참고 표시만 할 수 있다.
- 그 표시도 저장 데이터가 아니라 read-only suggestion 이어야 한다.

## 4. 권장 UX

### 4.1 생성 흐름

1. 가족방 생성
- 채팅 탭에서 `가족방 만들기`
- 멤버 초대
- 방 생성 후 `가족 구조 설정` 진입

2. 기존 그룹방 전환
- 그룹방 설정에서 `가족방으로 전환`
- 전환 후 `가족 구조 설정` 진입

### 4.2 가족방 안의 관계 설정

family room 상세에 `관계 설정` 또는 `가족 구조` 메뉴를 둔다.

- 멤버 목록 표시
- 멤버별 호칭 편집
- `보호자 추가`
- `자녀 추가`
- `보호자-자녀 연결`

권장 입력 방식:

- 먼저 멤버별 호칭 입력
- 다음으로 `누가 누구의 보호자인지`를 연결
- child 중심으로 관계를 보는 UI 가 이해하기 쉽다

예:

- 민수
  - 보호자: 엄마, 아빠, 할머니
- 지수
  - 보호자: 엄마, 아빠

## 5. 최소 데이터 모델

### 5.1 room_member_profiles

family room 안에서의 표시 이름만 관리한다.

```sql
CREATE TABLE room_member_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  alias TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (room_id, user_id)
);
```

설명:

- `alias`: 이 family room 안에서 보이는 자유 호칭
- 비워 두면 기본 프로필명 사용

### 5.2 room_relationships

```sql
CREATE TABLE room_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  guardian_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  child_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL
    CHECK (relationship_type IN ('guardian_child')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'removed')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (guardian_user_id <> child_user_id),
  UNIQUE (room_id, guardian_user_id, child_user_id, relationship_type)
);
```

설명:

- room 안에서만 유효한 관계다
- 보호자 다대다 허용
- 자녀 다대다 허용

## 6. 권한 원칙

- 권한은 호칭이 아니라 `guardian_child` 관계로 계산한다.
- family room 멤버라고 해서 자동으로 보호자 권한을 주지 않는다.
- 자녀의 위치/일정/할일 권한은 explicit `guardian_child` 링크가 있어야 생긴다.

## 7. 이번 범위

### 7.1 바로 할 것

- 친구 탭 가족 연결 UI 제거
- 가족방 생성/초대 유지
- 가족방 안의 자유 호칭 편집
- 가족방 안의 `guardian_child` 관계 설정

### 7.2 나중에 할 것

- `공동 보호자` suggestion
- 보호자 권한 템플릿
- 가족방 멤버 관리 정책 고도화

## 8. API 제안

- `POST /v1/rooms/:roomId/convert-to-family`
- `GET /v1/rooms/:roomId/member-profiles`
- `PATCH /v1/rooms/:roomId/member-profiles/:userId`
- `GET /v1/rooms/:roomId/relationships`
- `POST /v1/rooms/:roomId/relationships`
- `DELETE /v1/rooms/:roomId/relationships/:relationshipId`
- `POST /v1/rooms/:roomId/invitations`

### 관계 생성 예시

```json
{
  "relationshipType": "guardian_child",
  "guardianUserId": "uuid-guardian",
  "childUserId": "uuid-child"
}
```

## 9. 구현 순서

1. 친구 탭의 가족 연결 흐름 제거
2. family room 상세에 `가족 구조` 진입 추가
3. `room_member_profiles.alias` 연결
4. `room_relationships(guardian_child)` 추가
5. 권한 계산을 explicit relationship 기반으로 전환

## 10. 한 줄 권고

가족은 친구에서 만들지 말고, 가족방 안에서 자유 호칭과 `guardian_child` 관계만 관리하자.
