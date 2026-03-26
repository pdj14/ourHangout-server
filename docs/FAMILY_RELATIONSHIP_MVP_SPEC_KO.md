# 가족 관계 MVP 상세 스펙

작성일: 2026-03-26
상태: Draft
목적: 친구 관계를 가족 관계로 업그레이드하는 MVP를 실제 구현 가능한 수준으로 정의

## 1. 범위

이 문서는 아래 범위를 다룬다.

1. DB 스키마 초안
2. API 명세 초안
3. 앱 화면 플로우 초안
4. 1차 구현 순서와 롤아웃 계획

이번 MVP의 핵심은 "친구를 가족으로 업그레이드"하는 구조를 만드는 것이다.
위치, 시간표, ToDo, 가족 일정 공유는 후속 기능이지만, 그 기능이 자연스럽게 올라갈 수 있는 기본 데이터 구조와 권한 구조를 이번에 같이 설계한다.

## 2. 이번 MVP의 목표

### 2.1 반드시 되는 것

- 이미 친구인 상대를 가족 관계로 업그레이드 요청할 수 있다
- 상대가 요청을 수락/거절할 수 있다
- 가족 관계가 생성되면 앱에서 `가족`으로 구분되어 보인다
- 가족 관계에는 엄마/아빠/보호자/자녀 같은 관계 라벨이 붙는다
- 향후 위치, 시간표, ToDo, 일정 공유 기능을 붙일 수 있도록 family group과 permission 모델의 기본 골격이 준비된다

### 2.2 이번 MVP에서는 하지 않는 것

- 실시간 위치 추적 자체 구현
- 시간표 CRUD 구현
- ToDo CRUD 구현
- 가족 캘린더 구현
- 가족 그룹 병합
- 복잡한 다중 보호자 정책

## 3. 현재 상태와 제약

현재 백엔드에는 아래 구조가 이미 존재한다.

- `friend_requests`
- `friendships`
- `user_relationships`
- `pairing_codes.relationship_type`
- `guardian` 모듈의 `parent_child` 링크 조회

즉, 친구 기능과 부모-자녀 관계의 기본 개념은 이미 있다.
문제는 이 관계가 앱 UX와 서비스 모델 수준에서 아직 "가족 제품"으로 정리되어 있지 않다는 점이다.

현재 제약:

- 친구 목록 응답은 `trusted` 중심이라 가족 정보를 직접 표현하지 못함
- 가족 관계를 만드는 앱용 API가 없음
- `guardian`은 콘솔/운영 도구 성격이 강하고 앱용 가족 서비스로 쓰기에는 부적합함
- 향후 위치/시간표/ToDo/일정 공유를 붙일 그룹/권한 모델이 없음

## 4. 설계 원칙

### 4.1 친구를 없애지 않는다

가족 업그레이드는 친구를 대체하지 않는다.

- 업그레이드 전: `friend`
- 업그레이드 후: `friend + family`

이유:

- 기존 채팅/친구 기능을 보존할 수 있다
- 가족이어도 결국 서로 친구로서 채팅한다
- 롤백과 관리가 쉽다

### 4.2 시스템 역할과 가족 역할을 분리한다

현재 `users.role`은 `parent` / `user`다.
이 값은 시스템 접근권한에 사용한다.

반면, 사용자에게 보이는 가족 라벨은 아래처럼 별도 개념으로 관리한다.

- mother
- father
- guardian
- child
- sibling

즉, 아래를 분리한다.

- 시스템 역할: `parent`, `user`
- 관계 타입: `friend`, `parent_child`
- 가족 라벨: `mother`, `father`, `guardian`, `child`

### 4.3 가족 기능은 개인 관계가 아니라 가족 그룹 위에 올린다

부모 1명과 자녀 1명만 생각하면 pair relation만으로 충분해 보일 수 있다.
하지만 아래 시나리오를 고려하면 `family_group`이 필요하다.

- 엄마 + 아빠 + 자녀 1명
- 엄마 + 자녀 2명
- 부모 2명이 자녀의 일정/ToDo/위치를 함께 관리
- 형제끼리 가족 일정 공유

따라서 이번 MVP에서는 실제 기능이 없어도 family group을 도입한다.

## 5. 도메인 모델

### 5.1 핵심 엔티티

#### A. Friendship

현재와 동일

- 친구 요청
- 친구 수락
- 친구 목록
- direct room

#### B. Family Upgrade Request

친구를 가족 관계로 승격하기 위한 요청

- 요청자
- 대상
- 요청 관계 타입
- 요청자 라벨
- 대상 라벨
- 상태

#### C. Family Group

가족 기능의 컨테이너

- 가족 멤버
- 가족 서비스 권한
- 향후 일정/ToDo/위치 공유의 기준 단위

#### D. Family Link / Relationship

두 사용자 사이의 가족 관계 링크

- `parent_child`
- family group에 소속됨
- 누가 누구를 어떤 라벨로 보는지 저장

#### E. Family Service Permission

향후 서비스별 권한 레코드

- 위치 조회
- 시간표 조회/수정
- ToDo 조회/수정
- 가족 일정 조회/수정

## 6. 데이터 모델 초안

## 6.1 기존 테이블 활용

아래 테이블은 유지한다.

- `friendships`
- `friend_requests`
- `user_relationships`

이 중 `user_relationships`는 사람 대 사람 관계의 정식 테이블로 계속 사용한다.

## 6.2 기존 테이블 변경안

### 6.2.1 `user_relationships` 확장

현재 `user_relationships.relationship_type`은 `friend`, `parent_child`만 지원한다.
이번 MVP에서는 `parent_child`를 유지하면서 메타데이터를 추가한다.

권장 추가 컬럼:

```sql
ALTER TABLE user_relationships
  ADD COLUMN IF NOT EXISTS family_group_id UUID REFERENCES family_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS label_for_user_a TEXT,
  ADD COLUMN IF NOT EXISTS label_for_user_b TEXT,
  ADD COLUMN IF NOT EXISTS upgraded_from_friendship BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
```

의미:

- `family_group_id`
  - 이 관계가 어느 가족 그룹에 속하는지
- `label_for_user_a`, `label_for_user_b`
  - 각 당사자에게 보이는 관계 라벨
  - 예: `father`, `child`
- `upgraded_from_friendship`
  - 친구 업그레이드로 생성된 관계인지
- `confirmed_at`
  - 상대 승인 완료 시점
- `metadata`
  - 추후 옵션 저장용

### 6.2.2 라벨 값 제한

초기 지원값:

- `mother`
- `father`
- `guardian`
- `child`

후속 확장:

- `sibling`
- `grandparent`
- `other`

## 6.3 신규 테이블

### 6.3.1 `family_upgrade_requests`

친구 관계에서 가족 관계로 바꾸는 승인 요청 테이블

```sql
CREATE TABLE family_upgrade_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_relationship_id UUID REFERENCES user_relationships(id) ON DELETE SET NULL,
  requested_relationship_type TEXT NOT NULL
    CHECK (requested_relationship_type IN ('parent_child')),
  requester_label TEXT NOT NULL
    CHECK (requester_label IN ('mother', 'father', 'guardian', 'child')),
  target_label TEXT NOT NULL
    CHECK (target_label IN ('mother', 'father', 'guardian', 'child')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'canceled', 'expired')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

CREATE INDEX idx_family_upgrade_requests_requester_id
  ON family_upgrade_requests(requester_id);

CREATE INDEX idx_family_upgrade_requests_target_id
  ON family_upgrade_requests(target_user_id);
```

설계 포인트:

- `source_relationship_id`는 선택사항이다
- friend upgrade를 전제로 하지만, 실제 구현에서는 requester/target이 친구인지 검증 후 생성한다
- `note`는 추후 "아빠로 연결해 주세요" 같은 메시지용

### 6.3.2 `family_groups`

```sql
CREATE TABLE family_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'archived')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

`name`은 MVP에서는 optional이다.
초기에는 자동 생성 이름을 써도 된다.

예:

- `김민수 가족`
- `우리 가족`

### 6.3.3 `family_group_members`

```sql
CREATE TABLE family_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_group_id UUID NOT NULL REFERENCES family_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_role TEXT NOT NULL
    CHECK (member_role IN ('parent', 'child', 'guardian')),
  display_label TEXT NOT NULL
    CHECK (display_label IN ('mother', 'father', 'guardian', 'child')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'invited', 'removed')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_at TIMESTAMPTZ,
  UNIQUE (family_group_id, user_id)
);

CREATE INDEX idx_family_group_members_user_id
  ON family_group_members(user_id);
```

역할과 라벨을 분리하는 이유:

- 시스템 권한은 `member_role`을 본다
- UI는 `display_label`을 본다

예:

- `member_role = parent`, `display_label = mother`
- `member_role = parent`, `display_label = father`

### 6.3.4 `family_service_permissions`

```sql
CREATE TABLE family_service_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_group_id UUID NOT NULL REFERENCES family_groups(id) ON DELETE CASCADE,
  actor_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  service_key TEXT NOT NULL
    CHECK (service_key IN ('location', 'schedule', 'todo', 'family_calendar')),
  permission_level TEXT NOT NULL
    CHECK (permission_level IN ('none', 'view', 'edit', 'manage')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

설계 포인트:

- `actor_user_id`: 권한 행사 주체
- `subject_user_id`: 보호 대상
- `family_calendar` 같은 그룹 공통 기능은 `subject_user_id = NULL` 허용 가능

## 6.4 관계 생성 규칙

### 6.4.1 친구 업그레이드 요청 생성 조건

- 요청자와 대상은 이미 친구여야 함
- 자기 자신에게 요청 불가
- pending 요청 중복 불가
- `parent_child`는 최소 한쪽이 `users.role = parent` 이어야 함

### 6.4.2 수락 시 처리 순서

1. `family_upgrade_requests.status = accepted`
2. family group 결정
3. `family_group_members` upsert
4. `user_relationships`에 `parent_child` upsert
5. 기본 permission 템플릿 생성
6. realtime / push 이벤트 발행

### 6.4.3 family group 결정 규칙

MVP 규칙:

- 둘 다 family group이 없으면 새 group 생성
- 요청자만 group이 있으면 대상을 같은 group에 추가
- 대상만 group이 있으면 요청자를 같은 group에 추가
- 둘 다 다른 group이면 자동 병합 금지, 에러 반환

권장 에러 메시지:

- `Target user already belongs to another family group. Manual merge flow is required.`

## 7. API 초안

## 7.1 엔드포인트 목록

### 요청 생성

`POST /v1/family/upgrade-requests`

### 요청 조회

`GET /v1/family/upgrade-requests`

### 요청 수락

`POST /v1/family/upgrade-requests/:requestId/accept`

### 요청 거절

`POST /v1/family/upgrade-requests/:requestId/reject`

### 요청 취소

`POST /v1/family/upgrade-requests/:requestId/cancel`

### 가족 링크 목록

`GET /v1/family/links`

### 가족 그룹 요약

`GET /v1/family/groups/me`

### 가족 링크 수정

`PATCH /v1/family/links/:relationshipId`

### 가족 권한 조회

`GET /v1/family/groups/:familyGroupId/permissions`

### 가족 권한 수정

`PATCH /v1/family/groups/:familyGroupId/permissions`

## 7.2 요청 생성 API

### Request

```json
{
  "targetUserId": "uuid",
  "relationshipType": "parent_child",
  "requesterLabel": "father",
  "targetLabel": "child",
  "note": "가족 연결해요"
}
```

### Validation

- requester와 target은 친구여야 함
- requesterLabel / targetLabel 조합은 허용되는 pair여야 함

허용 조합:

- `father -> child`
- `mother -> child`
- `guardian -> child`
- `child -> father`
- `child -> mother`
- `child -> guardian`

### Response

```json
{
  "success": true,
  "data": {
    "requestId": "uuid",
    "status": "pending",
    "targetUserId": "uuid",
    "relationshipType": "parent_child",
    "requesterLabel": "father",
    "targetLabel": "child",
    "createdAt": "2026-03-26T10:00:00.000Z"
  }
}
```

## 7.3 요청 목록 API

### Response

```json
{
  "success": true,
  "data": {
    "incoming": [
      {
        "requestId": "uuid",
        "requester": {
          "userId": "uuid",
          "name": "아빠",
          "avatarUri": ""
        },
        "relationshipType": "parent_child",
        "requesterLabel": "father",
        "targetLabel": "child",
        "note": "",
        "createdAt": "2026-03-26T10:00:00.000Z"
      }
    ],
    "outgoing": []
  }
}
```

## 7.4 요청 수락 API

### Response

```json
{
  "success": true,
  "data": {
    "requestId": "uuid",
    "status": "accepted",
    "familyGroupId": "uuid",
    "relationshipId": "uuid",
    "relationshipType": "parent_child",
    "roomId": "uuid",
    "permissionsSeeded": true
  }
}
```

## 7.5 가족 링크 목록 API

### Response

```json
{
  "success": true,
  "data": [
    {
      "relationshipId": "uuid",
      "familyGroupId": "uuid",
      "relationshipType": "parent_child",
      "status": "active",
      "me": {
        "userId": "uuid",
        "memberRole": "parent",
        "displayLabel": "father"
      },
      "peer": {
        "userId": "uuid",
        "name": "민지",
        "avatarUri": "",
        "memberRole": "child",
        "displayLabel": "child"
      },
      "serviceSummary": {
        "location": "view",
        "schedule": "manage",
        "todo": "manage",
        "familyCalendar": "view"
      },
      "directRoomId": "uuid",
      "createdAt": "2026-03-26T10:00:00.000Z"
    }
  ]
}
```

## 7.6 친구 목록 API 확장

현재 `GET /v1/friends` 응답에 family summary를 추가하는 것을 권장한다.

### Friend item extension

```json
{
  "id": "uuid",
  "name": "민지",
  "status": "안전하게 대화 중",
  "avatarUri": "",
  "trusted": false,
  "family": {
    "isFamily": true,
    "relationshipType": "parent_child",
    "displayLabel": "child",
    "familyGroupId": "uuid",
    "status": "active"
  }
}
```

앱은 이 필드만으로도 친구/가족 섹션을 구분할 수 있다.

## 7.7 Realtime 이벤트 초안

현재 앱은 `friend.updated`, `room.updated` 등을 사용한다.
가족 기능에는 별도 이벤트를 추가하는 것을 권장한다.

### Event: `family.updated`

payload 예시:

```json
{
  "event": "family.updated",
  "data": {
    "type": "upgrade_request.incoming",
    "requestId": "uuid"
  }
}
```

추천 type:

- `upgrade_request.incoming`
- `upgrade_request.accepted`
- `upgrade_request.rejected`
- `link.created`
- `link.updated`
- `permissions.updated`

## 8. 앱 UX 초안

## 8.1 친구 탭 정보 구조

친구 탭은 아래 순서를 권장한다.

1. 가족 요청
2. 가족
3. 친구

### 섹션 1. 가족 요청

- 수신 요청 카드
- 발신 요청 카드

수신 카드 예시:

- 요청자 이름
- 관계 제안: `아빠로 연결`
- 수락 / 거절

### 섹션 2. 가족

가족 카드 예시:

- 프로필 이미지
- 이름
- 관계 배지: `엄마`, `아빠`, `자녀`, `보호자`
- 보조 텍스트:
  - `위치 보기 가능`
  - `시간표 관리 준비 중`
- 액션:
  - `채팅`
  - `가족 관리`

### 섹션 3. 친구

기존 친구 카드 유지

추가 액션:

- `가족으로 업그레이드`

## 8.2 업그레이드 플로우

### Flow A. 친구 -> 가족 업그레이드

1. 친구 카드 overflow 메뉴 클릭
2. `가족으로 업그레이드` 선택
3. 바텀시트 표시
4. 관계 선택
5. 확인 후 요청 전송

### 바텀시트 예시

```text
[가족으로 연결]

이 친구를 어떤 가족 관계로 연결할까요?

( ) 내가 아빠이고 상대가 자녀
( ) 내가 엄마이고 상대가 자녀
( ) 내가 보호자이고 상대가 자녀
( ) 내가 자녀이고 상대가 아빠
( ) 내가 자녀이고 상대가 엄마
( ) 내가 자녀이고 상대가 보호자

[취소] [요청 보내기]
```

## 8.3 수락 후 화면 반영

수락 완료 시:

- 친구 섹션에는 그대로 남음
- 가족 섹션에도 나타남
- 친구 카드에는 `가족` 배지 표시 가능

권장 UX:

- 가족 섹션 우선 노출
- 친구 섹션에서는 작은 `가족` 라벨만 노출

## 8.4 가족 상세 화면

MVP에서 필요한 최소 화면

화면 제목:

- `가족 관리`

표시 항목:

- 이름
- 관계 라벨
- direct chat 열기
- 현재 권한 요약
- 위치 권한: 준비 중
- 시간표 권한: 준비 중
- ToDo 권한: 준비 중
- 관계 해제

MVP에서는 실제 권한 변경 UI를 막고, `준비 중`으로 보여줘도 된다.
중요한 것은 family detail entry point를 지금 만드는 것이다.

## 9. 서비스 권한 기본 템플릿

요청 수락 시 아래 기본 권한 템플릿을 seed한다.

### 9.1 parent -> child

- location: `view`
- schedule: `manage`
- todo: `manage`
- family_calendar: `view`

### 9.2 child -> parent

- location: `none`
- schedule: `view`
- todo: `view`
- family_calendar: `view`

### 9.3 guardian -> child

- location: `view`
- schedule: `edit`
- todo: `edit`
- family_calendar: `view`

이 값은 후속 UI가 붙기 전까지는 백엔드 seed만 해도 충분하다.

## 10. 권한 체크 규칙 초안

향후 가족 기능에서 공통적으로 아래 순서로 검사한다.

1. actor와 subject가 같은 family group에 있는가
2. 둘 사이의 active family link가 있는가
3. 해당 service_key permission이 있는가
4. permission_level이 요청 action을 만족하는가

예:

- 위치 조회: `view` 이상
- 시간표 수정: `edit` 이상
- ToDo 전체 관리: `manage`

## 11. 구현 순서 제안

## 11.1 Phase 1 - 백엔드 관계 모델

작업:

1. migration 추가
2. `family_upgrade_requests` 테이블 생성
3. `family_groups` 생성
4. `family_group_members` 생성
5. `family_service_permissions` 생성
6. `user_relationships` 확장

완료 기준:

- DB level로 가족 관계 생성 가능한 상태

## 11.2 Phase 2 - 백엔드 서비스/API

작업:

1. `FamilyService` 추가
2. `/v1/family/*` 라우트 추가
3. 친구 목록 응답에 family summary 추가
4. realtime `family.updated` 추가

완료 기준:

- API만으로 요청 생성/수락/조회 가능

## 11.3 Phase 3 - 앱 UI

작업:

1. 친구 카드에 `가족으로 업그레이드` 액션 추가
2. 가족 요청 섹션 추가
3. 가족 섹션 추가
4. 가족 상세 화면 추가

완료 기준:

- 앱에서 친구 -> 가족 승격 UX가 완성됨

## 11.4 Phase 4 - 후속 서비스 자리 만들기

작업:

1. 가족 상세 화면에서 서비스 카드 placeholder 표시
2. 권한 summary 렌더링
3. 향후 위치/시간표/ToDo 화면 진입점 배치

완료 기준:

- 후속 기능을 붙일 UI/권한 자리 확보

## 12. MVP 수용 기준

아래가 되면 이번 MVP는 성공으로 본다.

1. 친구인 상대에게만 가족 업그레이드 요청 가능
2. 상대가 수락하면 family group과 family link가 생성됨
3. direct chat은 그대로 유지됨
4. 앱 친구 탭에서 `가족` 섹션으로 분리되어 보임
5. 가족 카드에 관계 라벨이 노출됨
6. 향후 위치/시간표/ToDo/일정 기능을 붙일 수 있는 permission skeleton이 존재함

## 13. 권장 구현 전략

실제 구현은 아래 전략을 추천한다.

- 이번 배치에서 실제 기능은 "관계 업그레이드"까지만 구현
- 위치/시간표/ToDo는 API/DB만 미리 과하게 만들지 말고 permission skeleton만 생성
- `guardian` 모듈은 운영/콘솔 용도로 유지
- 앱용 가족 서비스는 `FamilyService`로 새로 분리

## 14. 최종 결론

가장 안정적인 방향은 아래다.

1. 친구 관계는 유지
2. 가족 관계는 `user_relationships + family_group` 위에 추가
3. 앱에서는 친구 탭 안에 `가족 요청`, `가족`, `친구` 구조 도입
4. 후속 서비스는 family permission 모델 위에 순차적으로 확장

이 구조를 따르면 현재 코드베이스를 크게 뒤엎지 않으면서도, 앞으로 가족 기능을 제품 레벨로 확장할 수 있다.
