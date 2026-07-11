# OurHangout Server 안정성·보안 보강 기록

## 반영 범위

- 운영 환경의 예제 비밀값 및 약한 Guardian 자격증명 제거
- DB·Redis·FCM·HTTP 요청 타임아웃과 종료 처리 보강
- 미디어 업로드 동시성, 대기열, 사용자별 용량 제한 추가
- 인증·친구·가족·메시지 처리의 동시성 및 권한 검사 보강
- 배포 전 중복 데이터 검사, migration 잠금, 실패 복구 절차 추가
- PostgreSQL 조회 및 중복 방지 인덱스 추가

OpenClaw Connector와 Pobi 기능 변경은 이 보강 범위에 포함하지 않는다.

## 배포 전 확인

마이그레이션 `020_security_and_query_indexes.sql`은 기존 관계 페어링 코드를 모두
무효화하고 이후 코드 원문 대신 SHA-256 해시를 저장한다. 배포 후 진행 중이던 관계
페어링은 새 코드를 발급해야 한다.

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
