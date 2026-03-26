# Family Room Migration Plan

작성일: 2026-03-26
상태: Proposed
목표: 현재의 `family link + family_group` 구조를 `family room` 중심 구조로 전환한다.

## 1. 요약

권장 방향은 아래와 같다.

- 친구는 개인 연결로만 유지한다.
- 가족은 `rooms.type = 'family'` 인 특별한 그룹으로 다룬다.
- 가족 기능은 사람-사람 관계가 아니라 family room 에 붙인다.
- guardian/parental access 는 가족 UX 와 분리해서 다룬다.

즉, 앞으로의 기준 모델은 아래와 같다.

- `friendships`: 개인 연결
- `rooms`: 대화와 협업의 공통 컨테이너
- `room_members`: 방 멤버십
- `room_member_profiles`: family room 안에서의 멤버별 호칭/역할 표시
- `room_features`: family room 전용 기능 스위치
- `room_member_permissions`: family room 안의 멤버별 권한

## 2. 현재 구현 기준점

현재 구조는 "가족"이 채팅 room 모델과 분리되어 있다.

### 2.1 서버

- `rooms` 는 아직 `direct | group` 만 지원한다.
  - 파일: `db/migrations/007_backend_api_spec_core.sql`
- 가족 관련 별도 테이블이 이미 있다.
  - `family_groups`
  - `family_group_members`
  - `family_service_permissions`
  - `family_upgrade_requests`
  - 파일: `db/migrations/011_family_relationship_mvp.sql`
- `FamilyService` 는 가족 수락 시 `family_group` 과 `user_relationships.relationship_type = 'parent_child'` 를 함께 만든다.
  - 파일: `src/modules/family/family.service.ts`
- `SocialService.listFriends()` 는 친구 목록에 family summary 를 덧붙인다.
  - `friend.family`
  - `family_group_members.custom_label` 을 친구 alias fallback 으로도 사용한다.
  - 파일: `src/modules/social/social.service.ts`

### 2.2 앱

- 친구 탭 안에 `friends | family` 모드가 섞여 있다.
  - 파일: `ourHangout/App.tsx`
- 채팅 탭은 `direct | group` 만 가정한다.
  - family room 개념이 없다.
- 친구 목록의 family pill 과 family link 제거 액션이 존재한다.

### 2.3 guardian

- guardian 요약과 조회는 `user_relationships.relationship_type = 'parent_child'` 를 직접 기준으로 삼는다.
  - 파일: `src/modules/guardian/guardian.service.ts`
- 즉, 현재는 "가족 UX" 와 "보호자 권한" 이 같은 데이터 축에 걸려 있다.

## 3. 왜 전환이 필요한가

현재 구조의 문제는 아래와 같다.

- 가족이 room 이 아니라 별도 도메인이라서 채팅/멤버십/권한 모델이 이원화된다.
- 친구 목록이 가족 요약까지 끌어안고 있어서 UI 와 데이터 모델이 얽혀 있다.
- 현재 흐름은 한 사용자의 다중 family group 을 막는다.
  - 하지만 실제 요구는 `우리 가족`, `외가 가족` 같은 다중 family room 을 허용해야 한다.
- 가족 멤버 제거 정책이 사람-사람 link 삭제 중심이라서, "그 그룹에서만 나가기"를 자연스럽게 표현하기 어렵다.
- guardian 용 `parent_child` 와 일반 가족 UX 가 같은 축이라서 확장 시 충돌이 커진다.

## 4. 목표 구조

## 4.1 핵심 원칙

- 친구 목록은 친구만 보여준다.
- direct room 생성 조건은 계속 friendship 에 둔다.
- 가족은 room 으로 만들고, room 내부에서 멤버/호칭/권한을 관리한다.
- 가족 기능은 family room 안에서만 동작한다.
- 여러 family room 소속을 허용한다.
- 멤버 제거는 room membership 변경으로 처리한다.
- friendship 삭제와 family room 탈퇴/제거는 분리한다.

## 4.2 목표 데이터 모델

### 공통 테이블

- `friendships`
- `friend_requests`
- `rooms`
- `room_members`
- `room_user_settings`
- `room_messages`

### 확장 테이블

#### 1) `rooms`

- `type` 을 `direct | group | family` 로 확장
- family room 도 일반 room 과 같은 목록/메시지/알림 체계를 사용

#### 2) `room_member_profiles`

권장 컬럼:

- `id`
- `room_id`
- `user_id`
- `alias`
- `role_label`
- `membership_kind`
- `created_at`
- `updated_at`
- `UNIQUE (room_id, user_id)`

설명:

- `alias`: 이 family room 안에서 보이는 호칭
- `role_label`: `mother`, `father`, `guardian`, `child` 같은 표시 라벨
- `membership_kind`: 필요하면 `adult`, `child`, `guardian` 같은 분류

#### 3) `room_features`

권장 컬럼:

- `id`
- `room_id`
- `feature_key`
- `enabled`
- `created_at`
- `updated_at`
- `UNIQUE (room_id, feature_key)`

예시 `feature_key`:

- `location`
- `schedule`
- `todo`
- `family_calendar`

#### 4) `room_member_permissions`

권장 컬럼:

- `id`
- `room_id`
- `user_id`
- `subject_user_id`
- `permission_key`
- `permission_level`
- `created_at`
- `updated_at`

예시:

- `permission_key = 'location'`
- `permission_level = 'view' | 'edit' | 'manage' | 'none'`
- `subject_user_id` 가 `NULL` 이면 room-level 권한

#### 5) `family_room_invitations`

권장 컬럼:

- `id`
- `room_id`
- `inviter_user_id`
- `target_user_id`
- `status`
- `note`
- `created_at`
- `updated_at`
- `responded_at`
- `expires_at`

설명:

- 현재 `family_upgrade_requests` 를 완전히 대체할 최종 테이블
- 초기 전환 단계에서는 legacy 요청 테이블과 병행 가능

## 4.3 guardian 도메인 원칙

family room 은 "가족 UX" 의 source of truth 로 사용한다.

guardian/parental access 는 아래 원칙으로 분리한다.

- family room 멤버십만으로 guardian 권한을 자동 부여하지 않는다.
- 현재 `user_relationships.relationship_type = 'parent_child'` 는 guardian 호환용으로 임시 유지할 수 있다.
- 최종적으로는 `guardian_links` 또는 `guardian_access_grants` 같은 별도 테이블로 분리하는 것이 바람직하다.

즉, 이번 전환의 1차 목표는 "가족 UX 를 room 으로 옮기는 것" 이고, guardian 재설계는 그 다음 축이다.

## 5. 단계별 마이그레이션 계획

## 5.1 Phase 0: 결정 고정

구현 전 아래 항목을 확정한다.

- guardian 권한을 당장 분리할지, read-only 호환으로 남길지
- family room 생성 시 기본 제목 규칙
- family room 관리자 규칙
- 초대 수락 시 기존 family room 합류 규칙
- family room 나가기/멤버 제거/방 해체 정책

권장 결정은 아래와 같다.

- guardian 은 일단 legacy `parent_child` 를 유지한다.
- family room 은 한 사용자가 여러 개 가질 수 있다.
- family room 관리자 기본값은 room creator 와 성인 멤버다.
- family room 초대는 "기존 family_group 병합" 이 아니라 "특정 room 에 참가"로 바꾼다.
- family room 해체는 마지막 active member 가 없을 때 archive 처리한다.

## 5.2 Phase 1: 스키마 추가

기존 테이블을 바로 삭제하지 않고, 아래를 먼저 추가한다.

1. `rooms.type` 체크 제약을 `direct | group | family` 로 확장
2. `RoomType` 타입을 서버 DTO 에 추가
3. `room_member_profiles` 생성
4. `room_features` 생성
5. `room_member_permissions` 생성
6. `family_room_invitations` 생성
7. 필요하면 `legacy_family_group_room_map` 임시 매핑 테이블 생성

권장 원칙:

- destructive migration 금지
- 기존 read path 유지
- 새 구조는 add-only 로 먼저 도입

## 5.3 Phase 2: 백필

현재 active `family_group` 을 family room 으로 옮긴다.

### 백필 규칙

1. active `family_groups` 1개당 `rooms(type='family')` 1개 생성
2. `family_groups.name` 이 있으면 room title 로 사용
3. 없으면 임시 제목 생성
   - 예: `Family`, `엄마/아빠/OO 가족`
4. `family_group_members(status='active')` 를 `room_members` 로 복사
5. `family_group_members.custom_label` / `display_label` 을 `room_member_profiles` 로 복사
6. `family_service_permissions` 를 `room_member_permissions` 로 복사
7. `room_features` 는 권한 데이터나 정책에 맞춰 기본값 생성
8. `legacy_family_group_room_map(family_group_id, room_id)` 저장

### 관리자 매핑 권장

- `member_role in ('parent', 'guardian')` 는 `room_members.role = 'admin'`
- `member_role = 'child'` 는 `room_members.role = 'member'`

이 규칙은 generic room role 을 재사용하기 위한 임시 전략이다.
정교한 제어는 `room_member_permissions` 에 둔다.

## 5.4 Phase 3: 서버 dual-write / dual-read

완전 컷오버 전까지는 일정 기간 양쪽 구조를 같이 쓴다.

### write 전략

- 새 family invitation 생성 시
  - legacy: `family_upgrade_requests`
  - new: `family_room_invitations`
- 수락 시
  - legacy: 기존 `family_group`, `family_group_members`, `user_relationships` 갱신
  - new: `rooms(type='family')`, `room_members`, `room_member_profiles`, `room_member_permissions` 갱신

### read 전략

- family group 조회는 new room 기반 응답을 우선 사용
- legacy 데이터만 있는 경우 fallback 허용
- 친구 목록에서는 family summary 를 더 이상 내려주지 않도록 준비

### 중요한 변경점

현재 `SocialService.listFriends()` 는 friend 목록에 family summary 를 붙인다.
컷오버 이후에는 아래처럼 정리한다.

- friend 응답에서 `friend.family` 제거
- friend 이름 fallback 에 family custom label 사용 금지
- 가족 정보는 room 목록/room 상세에서만 읽는다

## 5.5 Phase 4: API 컷오버

권장 API 방향은 "family 도 room" 이다.

### 유지

- `GET /v1/friends`
- `POST /v1/friends/requests`
- `POST /v1/rooms/direct`
- `POST /v1/rooms/group`

### 추가

- `POST /v1/rooms/family`
- `GET /v1/rooms?type=family`
- `GET /v1/rooms/:roomId/members`
- `PATCH /v1/rooms/:roomId/member-profiles/:userId`
- `GET /v1/rooms/:roomId/permissions`
- `PATCH /v1/rooms/:roomId/permissions`
- `POST /v1/rooms/:roomId/invitations`
- `POST /v1/room-invitations/:invitationId/accept`
- `POST /v1/room-invitations/:invitationId/reject`

### 호환용 유지 후 제거

- `/v1/family/upgrade-requests`
- `/v1/family/links`
- `/v1/family/groups/me`
- `/v1/family/groups/:familyGroupId/permissions`

이 legacy API 들은 바로 삭제하지 말고, new room 모델을 감싸는 compatibility layer 로 잠시 유지하는 편이 안전하다.

## 5.6 Phase 5: 앱 컷오버

앱은 아래 순서로 바꾼다.

### 1) Friend 탭 정리

- `FriendsMode = 'friends' | 'family'` 제거
- 친구 탭에서는 친구만 보여준다
- family pill 제거
- family link 제거 액션 제거

### 2) Room 모델 확장

현재 앱과 서버는 room 을 사실상 `isGroup` 불리언으로 다룬다.
이 구조로는 `group` 과 `family` 를 구분할 수 없다.

따라서 아래가 필요하다.

- `RoomDto.type: 'direct' | 'group' | 'family'`
- 앱 `Room` 타입에도 `type` 추가
- `isGroup` 는 점진적으로 deprecated

### 3) 화면 구조 변경

권장 구조:

- 친구 탭: 친구만
- 그룹 탭: 일반 그룹 + 가족 그룹
- family room 상세:
  - 채팅
  - 위치
  - 일정
  - ToDo
  - 멤버 관리

### 4) 생성/초대 흐름

- 친구 상세 또는 친구 액션에서 "가족 그룹 초대" 실행
- 수락 후 새 family room 생성 또는 기존 family room 참가
- 이후 가족 관련 정보는 친구 목록이 아니라 family room 에서 노출

## 5.7 Phase 6: guardian 정리

guardian 은 family room 전환과 별개로 정리한다.

권장 순서는 아래와 같다.

1. family room 컷오버 완료
2. guardian console 이 family room 멤버십을 직접 쓰지 않게 유지
3. `parent_child` 를 guardian 호환용 read model 로만 남김
4. 추후 `guardian_links` 또는 `guardian_access_grants` 로 이관

즉, family room 전환을 guardian 재설계의 blocker 로 만들지 않는다.

## 5.8 Phase 7: 레거시 제거

아래 조건이 만족되면 legacy 제거를 진행한다.

- 모든 active family group 이 family room 으로 백필됨
- 앱이 `friend.family` 없이 동작함
- 신규 생성/초대/멤버 관리가 new room API 만 사용함
- guardian 의존 경로가 정리됨

제거 대상:

- `family_groups`
- `family_group_members`
- `family_service_permissions`
- `family_upgrade_requests`
- family link 중심 API

`user_relationships.parent_child` 는 guardian migration 완료 후에 별도로 제거 여부를 판단한다.

## 6. 데이터 전환 상세

## 6.1 변환 매핑

### legacy -> new

- `family_groups.id` -> `rooms.id` 또는 별도 매핑 테이블
- `family_groups.name` -> `rooms.title`
- `family_group_members` -> `room_members + room_member_profiles`
- `family_service_permissions` -> `room_member_permissions`
- `family_upgrade_requests` -> `family_room_invitations`

### 유지

- `friendships` 유지
- direct room 유지
- 일반 group room 유지

## 6.2 검증 쿼리 예시

백필 후 최소 검증 기준:

- active family group 수 = active family room 수
- 각 family group 의 active member 수 = 대상 family room 의 active member 수
- legacy permission row 수와 migrated permission row 수 비교
- room title 누락 여부 확인
- orphan member 여부 확인

## 6.3 롤백 전략

초기 단계에서는 legacy 구조를 유지하므로 rollback 은 아래 방식으로 한다.

- new read path feature flag off
- new write path off
- 앱에서 family room UI 숨김
- legacy API 와 legacy 테이블 계속 사용

즉, cleanup 전까지는 rollback 비용을 낮게 유지한다.

## 7. 코드 영향 범위

## 7.1 서버

- `db/migrations/007_backend_api_spec_core.sql`
  - `rooms.type` 확장
- 새 migration 파일
  - `room_member_profiles`
  - `room_features`
  - `room_member_permissions`
  - `family_room_invitations`
- `src/modules/social/social.types.ts`
  - `RoomType`, `RoomDto` 확장
- `src/modules/social/social.service.ts`
  - room list/create/update/leave/delete 정책 확장
  - friend.family 제거
- `src/modules/family/family.service.ts`
  - legacy 호환 또는 room wrapper 로 재구성
- `src/modules/guardian/guardian.service.ts`
  - family UX 와 guardian 권한의 경계 정리

## 7.2 앱

- `ourHangout/App.tsx`
  - friend/family 혼합 탭 제거
  - room type 확장
  - family room 상세 UI 진입 구조 추가

## 7.3 운영

- migration 전 DB 백업
- 백필 dry-run 쿼리 준비
- feature flag 또는 배포 순서 제어

## 8. 주요 리스크와 대응

### 리스크 1: 다중 가족 소속

현재 구현은 한 사용자의 다중 active family group 을 막는다.

대응:

- family room 모델에서는 이 제약을 제거
- invitation/멤버십 정책을 room 단위로 재정의

### 리스크 2: guardian 과 가족 UX 혼합

대응:

- family room 을 guardian source of truth 로 쓰지 않음
- guardian 축은 별도 단계로 분리

### 리스크 3: 앱이 room type 을 구분하지 못함

대응:

- `RoomDto.type` 추가
- 앱 내부 `isGroup` 의존 코드 점진 제거

### 리스크 4: 친구 목록 이름 오염

현재 family custom label 이 친구 alias fallback 으로 사용된다.

대응:

- friend list 에서 family-derived alias 제거
- 호칭은 family room 내부 프로필에서만 사용

### 리스크 5: 정책 불일치

현재 `leave/delete` 는 group 중심 규칙이다.

대응:

- family room 에 맞는 별도 정책 정의
- 예: child 는 self-leave 제한, admin 만 member removal 가능 등

## 9. 권장 작업 티켓 분할

### Backend

1. room type 확장과 새 family room 테이블 migration 추가
2. `RoomDto.type` 추가와 room 조회 API 확장
3. family room 생성/초대/수락 API 추가
4. family group -> family room 백필 스크립트 추가
5. friend list 에서 family summary 제거
6. legacy family API compatibility layer 추가

### App

7. `Room.type` 기반 UI 구조 변경
8. 친구 탭에서 family 모드 제거
9. family room 목록/상세/멤버 관리 UI 추가
10. legacy family link 액션 제거

### Guardian

11. guardian read path 의 legacy 의존 범위 고정
12. guardian 분리 2차 설계 문서 작성

## 10. 최종 권고

지금 구조에서 가장 안전한 전환 방식은 아래다.

1. family room 스키마를 add-only 로 먼저 넣는다.
2. legacy family_group 데이터를 family room 으로 백필한다.
3. 서버를 dual-read / dual-write 로 잠시 운영한다.
4. 앱을 friend-only 탭 + family room 중심 UI 로 전환한다.
5. guardian 은 별도 축으로 남겨 충돌을 피한다.
6. 운영 검증 후 legacy family tables 과 API 를 제거한다.

핵심은 "가족을 사람-사람 관계가 아니라 room 으로 승격" 하는 것이다.
이렇게 해야 채팅, 멤버 관리, 권한, 위치/일정/ToDo 같은 확장 기능이 모두 같은 컨테이너 위에서 정리된다.
