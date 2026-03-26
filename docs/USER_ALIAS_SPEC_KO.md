# 사용자별 별칭 기능 스펙

작성일: 2026-03-26

## 목적

상대가 설정한 공식 프로필명과, 내가 그 사람을 어떻게 부를지를 분리한다.

예:

- 공식 프로필명: `김영희`
- 내가 부르는 이름: `엄마`

## 표시 우선순위

1. 내 개인 별칭
2. 가족 그룹 공용 명칭(`family_group_members.custom_label`)
3. 상대 프로필명

## 데이터 구조

신규 테이블:

`user_aliases`

- `owner_user_id`
- `target_user_id`
- `alias`
- `created_at`
- `updated_at`

특징:

- 사용자별로 같은 사람을 다르게 부를 수 있음
- 친구/가족 공통 적용 가능
- 가족 공용 명칭보다 개인 명칭이 우선

## API

### 친구 목록

`GET /v1/friends`

추가 필드:

- `profileName`
- `aliasName`
- `name` = 최종 표시명

### 별칭 저장/삭제

`PATCH /v1/friends/:friendUserId/alias`

body:

```json
{
  "alias": "엄마"
}
```

삭제:

```json
{
  "alias": null
}
```

## 앱 UX

- 리스트 메인 텍스트: 별칭 우선
- 보조 텍스트: 공식 프로필명
- 액션 메뉴:
  - 별칭 설정/수정
  - 별칭 삭제

## 현재 구현 범위

- 서버: 저장/조회 가능
- 앱: 표시 우선순위 반영 및 편집 UI 추가 예정
