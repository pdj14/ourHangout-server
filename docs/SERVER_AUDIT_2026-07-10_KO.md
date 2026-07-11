# OurHangout Server 안정성·보안 보강 기록

## 반영 범위

- 운영 환경의 예제 비밀값 및 약한 Guardian 자격증명 제거
- DB·Redis·FCM·HTTP 요청 타임아웃과 종료 처리 보강
- 미디어 업로드 동시성, 대기열, 사용자별 용량 제한 추가
- 인증·친구·가족·메시지 처리의 동시성 및 권한 검사 보강
- 배포 전 중복 데이터 검사, migration 잠금, 실패 복구 절차 추가
- PostgreSQL 조회 및 중복 방지 인덱스 추가

## 배포 전 확인

마이그레이션 `020_security_and_query_indexes.sql`은 기존 관계 페어링 코드를 모두
무효화하고 이후 코드 원문 대신 SHA-256 해시를 저장한다. 배포 후 진행 중이던 관계
페어링은 새 코드를 발급해야 한다.

마이그레이션 `021_remove_legacy_openclaw.sql`은 더 이상 제공하지 않는 레거시 봇
기능을 제거한다. 다음 데이터가 영구 삭제되므로 배포 전 백업이 필요하다.

- 레거시 봇이 참여한 `rooms` 및 해당 방의 메시지·설정·신고
- 레거시 봇 사용자와 그 사용자의 구형 `chat_rooms` 및 메시지
- 폐기된 개발 브랜치가 만든 `pobis`, `openclaw_connector_*` 테이블
- `bots` 테이블과 `messages.claw_message_id` 컬럼

일반 사용자끼리의 방과 메시지는 이 migration의 삭제 대상이 아니다. 과거 migration
파일은 신규 DB 재현성과 기존 NAS의 migration 이력을 위해 유지하며, 최종 스키마는
`021` 적용 후 레거시 봇 구조가 없는 상태가 된다.

다음 중복 데이터가 있으면 배포 스크립트의 preflight 단계가 중단된다.

```sql
SELECT lower(email), COUNT(*)
FROM users
GROUP BY lower(email)
HAVING COUNT(*) > 1;

SELECT LEAST(requester_id, target_id), GREATEST(requester_id, target_id), COUNT(*)
FROM friend_requests
WHERE status = 'pending'
GROUP BY 1, 2
HAVING COUNT(*) > 1;

SELECT LEAST(requester_id, target_user_id),
       GREATEST(requester_id, target_user_id),
       requested_relationship_type,
       COUNT(*)
FROM family_upgrade_requests
WHERE status = 'pending'
GROUP BY 1, 2, 3
HAVING COUNT(*) > 1;
```

중복 행은 업무 기준에 따라 하나만 유지한 뒤 배포한다. 운영 배포 전 PostgreSQL
백업을 생성하고 `.env`의 `POSTGRES_PASSWORD`, `DATABASE_URL`, `JWT_SECRET`,
`PUBLIC_BASE_URL`, Guardian Console 자격증명을 다시 확인한다.

## 검증

```bash
npm ci
npm run check
npm test
```

NAS 배포 후에는 API 로그에서 migration 완료를 확인하고 `/health`, `/ready`를
호출한다.
