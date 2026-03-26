# 친구 관계를 가족 관계로 업그레이드하는 기본 구조 제안서

작성일: 2026-03-26

## 1. 목적

현재 Our Hangout에는 친구 요청, 친구 수락, 친구 목록, 직접 대화방, `trusted` 즐겨찾기, 그리고 백엔드 레벨의 `parent_child` 관계 모델이 이미 존재한다.

이번 목표는 다음과 같다.

1. 이미 친구로 연결된 사용자 중에서 특정 친구를 `가족`으로 업그레이드할 수 있어야 한다.
2. 가족이 되면 향후 부모-자녀 위치 조회, 시간표 관리, ToDo 관리, 가족 일정 공유 같은 기능을 자연스럽게 붙일 수 있어야 한다.
3. 친구 서비스와 가족 서비스가 앞으로 각각 확장되더라도 관계 모델이 뒤엉키지 않아야 한다.

## 2. 현재 상태 요약

현재 코드 기준으로 확인한 구조는 아래와 같다.

- 친구 관계
  - `friend_requests`
  - `friendships`
  - 친구 수락 시 direct room 자동 생성
- 일반 관계 모델
  - `pairing_codes.relationship_type`
  - `user_relationships`
  - 현재 허용 타입: `friend`, `parent_child`
- 보호자/가족 링크 조회
  - `guardian` 모듈에서 `parent_child` 링크를 관리 콘솔 관점으로 조회
- 앱 UI
  - 친구 탭은 사실상 `friendships + trusted` 중심으로만 보임
  - 가족 업그레이드 액션이나 가족 섹션은 아직 없음

즉, 백엔드에는 이미 가족 관계의 씨앗이 있지만, 앱 UX와 서비스 설계는 아직 친구 중심이다.

## 3. 핵심 제안

### 3.1 기본 원칙

가족은 친구를 대체하는 개념이 아니라, 친구 위에 얹히는 상위 관계로 보는 것이 맞다.

- 친구: 채팅, 가벼운 연결, 일반 소셜 관계
- 가족: 더 높은 신뢰와 더 강한 권한이 필요한 관계
- 부모/엄마/아빠 같은 것은 인증 역할이 아니라 가족 내 관계 라벨이다

권장 방향은 다음과 같다.

1. 친구 관계는 유지한다.
2. 가족 관계는 별도의 관계 계층으로 추가한다.
3. 가족용 서비스는 개인 대 개인 관계만으로 만들지 말고, `가족 그룹` 단위로 확장 가능하게 설계한다.

## 4. 가장 중요한 설계 포인트

### 4.1 시스템 역할과 가족 역할을 분리

현재 `users.role`은 `parent` / `user` 이다.
이 값은 권한용 시스템 역할로 유지하는 것이 맞다.

하지만 사용자가 앱에서 보고 싶은 가족 관계는 아래와 같은 라벨이다.

- 엄마
- 아빠
- 보호자
- 자녀
- 형제/자매
- 할머니/할아버지

따라서 아래 세 가지를 분리해야 한다.

1. 시스템 역할
   - `parent`, `user`
2. 관계 타입
   - `friend`, `parent_child`, 향후 `family_member`, `caregiver` 등
3. 가족 표시 라벨
   - `mother`, `father`, `guardian`, `child`, `sibling`

`엄마/아빠`는 시스템 역할이 아니라 가족 라벨이어야 한다.

### 4.2 친구 업그레이드는 "관계 추가"로 처리

친구를 가족으로 업그레이드할 때 기존 friendship을 지우지 않는 것을 권장한다.

이유는 명확하다.

- 기존 친구 채팅과 UI 흐름이 유지된다
- 가족이더라도 결국 친구 목록에서 보여줄 수 있다
- 친구 기능과 가족 기능을 분리 확장하기 쉽다
- 롤백이 쉽다

즉, 상태 변화는 아래처럼 보는 것이 좋다.

- 업그레이드 전: `friend`
- 업그레이드 후: `friend + family`

## 5. 추천 도메인 구조

### 5.1 관계 레이어 2단 구조

권장 구조는 아래 두 층이다.

#### A. 사람 대 사람 관계 레이어

목적: 두 사용자 사이의 직접 관계를 표현

예시:

- friend
- parent_child
- sibling
- caregiver_child

이 레이어는 "이 둘이 어떤 관계인가"를 정의한다.

#### B. 가족 그룹 레이어

목적: 가족 공통 기능의 컨테이너

예시:

- 가족 일정 공유
- 가족 ToDo
- 자녀 시간표
- 위치 공유
- 공지/체크인

이 레이어는 "이 기능을 어떤 가족 단위로 공유하는가"를 정의한다.

### 5.2 왜 가족 그룹이 필요한가

초기에는 친구 한 명을 엄마/아빠로 업그레이드하는 수준으로 시작할 수 있다.
하지만 다음 기능을 생각하면 결국 그룹이 필요하다.

- 자녀 한 명에게 엄마와 아빠가 함께 연결
- 형제 2명 이상
- 가족 전체 일정 공유
- 부모 2명과 자녀 N명에게 같은 ToDo/시간표/위치 권한 적용

따라서 장기적으로는 `가족 관계`와 `가족 그룹`을 분리하는 것이 가장 안전하다.

## 6. 데이터 모델 제안

### 6.1 단기 권장안

현재 구조를 최대한 살리면서 확장하는 방식이다.

#### 유지

- `friendships`
- `friend_requests`
- `user_relationships`

#### 확장

1. `user_relationships.relationship_type`
   - 현재: `friend`, `parent_child`
   - 단기 유지: `parent_child` 중심
2. `user_relationships`에 메타데이터 추가
   - `relationship_label_a`
   - `relationship_label_b`
   - `confirmed_at`
   - `upgraded_from_friendship boolean`
   - `settings_jsonb`
3. 별도 요청 테이블 추가
   - `family_upgrade_requests`

예시 컬럼:

```sql
family_upgrade_requests
- id
- requester_id
- target_user_id
- requested_type          -- parent_child
- requested_label_by_requester -- mother / father / guardian / child
- status                  -- pending / accepted / rejected / canceled
- created_at
- responded_at
```

이 방식의 장점:

- 현재 `friendships`를 크게 안 건드린다
- 현재 `guardian` 구조와 연결하기 쉽다
- 가족 업그레이드 요청 흐름을 독립적으로 만들 수 있다

### 6.2 중장기 권장안

위치, 일정, ToDo, 시간표 공유까지 갈 것을 전제로 하면 아래 구조를 추천한다.

#### 신규 엔티티

```text
family_groups
family_group_members
family_service_permissions
family_upgrade_requests
```

#### 추천 의미

- `family_groups`
  - 한 가족 단위의 컨테이너
- `family_group_members`
  - 가족 구성원
  - 예: mother, father, child, guardian
- `family_service_permissions`
  - 위치, 시간표, ToDo, 일정 공유 권한

예시:

```sql
family_groups
- id
- name
- status
- created_by
- created_at

family_group_members
- id
- family_group_id
- user_id
- member_role           -- parent / child / guardian
- display_label         -- mother / father / guardian / child
- status                -- active / invited / removed
- joined_at

family_service_permissions
- id
- family_group_id
- subject_user_id       -- 보호 대상(예: 자녀)
- actor_user_id         -- 권한 보유자(예: 부모)
- service_key           -- location / schedule / todo / calendar
- permission_level      -- view / edit / manage
- created_at
- updated_at
```

## 7. 친구에서 가족으로 업그레이드하는 UX 제안

### 7.1 시작점

업그레이드 시작점은 친구 목록의 각 친구 카드에서 제공하는 것이 가장 자연스럽다.

현재 앱 친구 탭에는 이미 친구 카드와 액션 버튼이 있다.
여기에 아래 액션을 추가하는 방식이 적절하다.

- `가족으로 업그레이드`
- 또는 `가족 연결`

### 7.2 추천 사용자 흐름

#### Step 1. 친구 카드에서 업그레이드 시작

사용자 액션:

- 친구 카드 우측 메뉴
- 프로필 상세 하단 버튼
- 친구 상세 화면 진입 후 가족 연결

#### Step 2. 가족 유형 선택

초기 MVP에서 추천하는 선택지는 아래 정도면 충분하다.

- 내가 부모이고 상대가 자녀
- 내가 자녀이고 상대가 부모
- 보호자

표시 라벨은 다음처럼 분리한다.

- 부모 측 라벨: 엄마 / 아빠 / 보호자
- 자녀 측 라벨: 자녀

#### Step 3. 상대 승인 요청

가족 업그레이드는 반드시 상대 승인 단계를 두는 것을 권장한다.

이유:

- 위치 추적, 일정 관리 등 민감 권한이 따라온다
- 실수로 가족 연결되는 것을 막아야 한다
- 친구와 가족은 신뢰 수준이 다르다

#### Step 4. 승인 후 가족 관계 생성

승인되면 아래를 수행한다.

1. 기존 friendship 유지
2. `parent_child` 또는 family relation 생성
3. 필요 시 family group 생성 또는 기존 family group에 합류
4. 기본 권한 템플릿 부여

## 8. 앱 표시 구조 제안

### 8.1 친구 탭 구조

초기에는 탭을 크게 늘리지 말고 친구 탭 안에서 아래처럼 나누는 것을 추천한다.

- 수신 요청
- 가족
- 친구

가족 섹션에 들어가는 카드는 친구보다 한 단계 더 많은 정보를 가진다.

예시:

- 이름
- 관계 배지: 엄마 / 아빠 / 자녀 / 보호자
- 권한 상태 요약
  - 위치 공유 켜짐
  - 일정 공유 준비중
  - ToDo 준비중

### 8.2 카드 표시 예시

친구 카드:

- 이름
- 상태 메시지
- 채팅 버튼
- 즐겨찾기 버튼
- 가족으로 업그레이드 버튼

가족 카드:

- 이름
- 관계 배지
- 가족 서비스 요약
- `가족 관리`
- `채팅`

### 8.3 상세 화면 제안

가족 관계가 생기면 친구 상세의 하위가 아니라 별도 `가족 관계 상세` 화면을 두는 것을 추천한다.

이 화면에서 관리할 것:

- 관계 라벨 변경
- 권한 on/off
- 위치 공유 허용 범위
- 시간표 접근 권한
- ToDo 관리 권한
- 가족 그룹 소속 정보

## 9. 권한 모델 제안

가족 관계가 생겼다고 해서 모든 권한을 자동으로 전부 허용하면 안 된다.

권장 방식은 `관계 생성`과 `서비스 권한 부여`를 분리하는 것이다.

### 9.1 기본 권한 템플릿

#### 부모-자녀 관계 기본 템플릿

- location: parent `view`
- schedule: parent `manage`
- todo: parent `manage`
- family_calendar: parent/child `view`

#### 확장 가능 포인트

- child self edit 허용 여부
- 위치 실시간/최근 위치만 허용 여부
- 일정 수정 가능 범위
- ToDo 완료 체크만 허용 여부

### 9.2 권한 체크 기준

권장 순서:

1. 사용자가 같은 family group에 속하는가
2. 대상 사용자와 적절한 relation이 있는가
3. 해당 서비스 권한이 있는가
4. 대상이 child인지, peer family member인지에 따라 범위를 다르게 적용

## 10. 서비스 제공 방식 제안

### 10.1 친구 서비스와 가족 서비스 분리

앞으로 서비스가 커질 것을 감안하면 API와 앱 메뉴를 아래처럼 분리하는 것이 좋다.

#### 친구 서비스

- 친구 요청/수락/삭제
- 1:1 대화
- 그룹 채팅
- 가벼운 소셜 상호작용

#### 가족 서비스

- 가족 연결/초대/승인
- 가족 구성원 관리
- 자녀 위치
- 자녀 시간표
- 가족 ToDo
- 가족 일정 공유

### 10.2 백엔드 서비스 구조 제안

현재 `SocialService`와 `GuardianService`가 분리되어 있다.
이 위에 앱용 `FamilyService`를 두는 것을 추천한다.

권장 이유:

- `GuardianService`는 현재 관리자/콘솔 성격이 강하다
- 부모가 앱에서 쓰는 기능과 운영자 콘솔은 성격이 다르다
- 앱용 가족 기능은 권한과 응답 스키마가 더 세밀해야 한다

권장 모듈 구조:

```text
SocialService
  - friends
  - friend requests
  - chat/social rooms

RelationshipService or FamilyService
  - family upgrade requests
  - family links
  - family groups
  - permissions

GuardianService
  - admin / support / monitoring console
```

## 11. API 제안

### 11.1 1차 MVP API

```text
POST   /v1/family/upgrade-requests
GET    /v1/family/upgrade-requests
POST   /v1/family/upgrade-requests/:requestId/accept
POST   /v1/family/upgrade-requests/:requestId/reject
GET    /v1/family/links
GET    /v1/family/links/:linkId
PATCH  /v1/family/links/:linkId
```

요청 예시:

```json
{
  "targetUserId": "uuid",
  "relationshipType": "parent_child",
  "requesterLabel": "father"
}
```

응답 예시:

```json
{
  "success": true,
  "data": {
    "requestId": "uuid",
    "status": "pending"
  }
}
```

### 11.2 친구 목록 응답 확장 제안

현재 친구 목록은 대략 `trusted` 중심이다.
가족 UI를 붙이려면 아래 필드가 필요하다.

```json
{
  "id": "user-id",
  "name": "홍길동",
  "status": "안전하게 대화 중",
  "avatarUri": "...",
  "trusted": true,
  "family": {
    "isFamily": true,
    "relationshipType": "parent_child",
    "displayLabel": "아빠",
    "status": "active"
  }
}
```

이렇게 하면 앱은 같은 친구 목록 API로도 친구/가족 섹션 분리가 가능해진다.

## 12. 운영 규칙 제안

### 12.1 가족 업그레이드 가능 조건

- 이미 친구여야 함
- 자기 자신은 불가
- 차단/삭제 상태면 불가
- `parent_child`는 한쪽은 `users.role = parent`, 한쪽은 `users.role = user` 이어야 함

### 12.2 가족 그룹 합류 규칙

초기 버전에서는 단순한 규칙이 좋다.

- 둘 다 family group이 없으면 새 그룹 생성
- 요청자만 family group이 있으면 상대를 요청자 그룹에 추가
- 둘 다 같은 그룹이면 관계만 추가
- 둘 다 다른 그룹이면 자동 병합 금지

가족 병합은 후속 기능으로 분리하는 것이 안전하다.

### 12.3 해제 규칙

가족 관계 해제도 soft-delete 또는 상태 변경으로 관리하는 것이 좋다.

- `active`
- `paused`
- `removed`

위치/시간표/ToDo 데이터는 가족 관계 해제 시 처리 정책을 분리해야 한다.

예:

- 즉시 접근 차단
- 공유 데이터는 보관
- 이력은 audit log로 유지

## 13. 단계별 개발 제안

### Phase 1. 관계 업그레이드 MVP

범위:

- 친구 카드에서 가족 업그레이드 시작
- 가족 업그레이드 요청/수락/거절
- 가족 섹션 표시
- 가족 배지 표시
- 기본 family link 관리 화면

핵심 목표:

- 친구에서 가족으로 전환되는 UX를 완성
- 기존 친구 기능을 깨지 않음

### Phase 2. 권한 모델 도입

범위:

- 서비스별 권한 설정
- 부모/자녀별 기본 정책
- 가족 링크 상세 화면

### Phase 3. 가족 서비스 1차

범위:

- 자녀 위치 보기
- 자녀 시간표 관리
- 자녀 ToDo 관리
- 가족 일정 공유

### Phase 4. 구조 일반화

범위:

- 형제/조부모/보호자 관계 확장
- 가족 그룹 병합
- 다가족/복수 보호자 정책

## 14. 현재 코드베이스 기준 권장 구현 방향

가장 현실적인 시작점은 아래다.

1. `friendships`는 그대로 유지
2. `user_relationships`는 가족용 정식 관계 테이블로 사용
3. `family_upgrade_requests`를 별도 추가
4. 앱 친구 목록 응답에 family summary를 붙임
5. 앱에서는 친구 탭 안에 `가족` 섹션을 추가
6. 위치/시간표/ToDo는 아직 붙이지 않고 권한 모델 자리만 만든다

이렇게 하면 현재 구조와 충돌이 적고, 미래 확장성도 충분하다.

## 15. 결론

이번 요구사항의 핵심은 "친구를 가족으로 바꾸는 버튼" 자체가 아니다.
진짜 핵심은 아래 두 가지다.

1. 친구 관계와 가족 관계를 분리해서 다룰 것
2. 미래의 가족 서비스가 붙을 수 있도록 가족 그룹과 권한 모델을 초기에 잡을 것

추천 결론은 다음과 같다.

- 단기: 친구 유지 + 가족 관계 추가
- 중기: family group + service permission 도입
- 장기: 위치/시간표/ToDo/일정 공유를 family group 위에 올림

이 방향이면 현재 백엔드의 `user_relationships(parent_child)`와 `guardian` 축을 재사용하면서도, 앱 UX를 친구 중심에서 가족 중심으로 자연스럽게 확장할 수 있다.
