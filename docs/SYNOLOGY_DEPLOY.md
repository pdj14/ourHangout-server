# Synology NAS 배포 가이드 (DSM 7.x, 초보자용)

이 문서는 `ourhangout-backend`를 Synology NAS에 배포하는 가장 단순한 절차를 설명합니다.

## 0) 목표와 전제

1. 목표: NAS에서 `api + postgres + redis + migrate`를 Docker Compose로 기동
2. 전제:
   - DSM 7.x
   - NAS와 같은 네트워크에서 테스트할 PC 1대

DSM 버전별 앱:

1. DSM 7.2+: `Container Manager`
2. DSM 7.1.x: `Docker` 패키지

## 1) NAS에 프로젝트 폴더 업로드

예시 경로:

- `/volume1/docker/ourhangout-backend`

업로드 후 아래 파일이 있어야 합니다.

1. `docker-compose.yml`
2. `Dockerfile`
3. `src/`, `db/`, `package.json` 등 전체 프로젝트

## 2) 환경 변수 파일(.env) 준비

1. NAS에서 프로젝트 폴더 열기
2. `.env.example`를 복사해서 `.env` 생성
3. 아래 항목 최소 수정

```env
NODE_ENV=production
PORT=3000
JWT_SECRET=<32자 이상 랜덤 문자열>
POSTGRES_PASSWORD=<강한 비밀번호>
CORS_ORIGINS=http://<APP_HOST_OR_DOMAIN>
OPENCLAW_MODE=mock
OPENCLAW_BASE_URL=http://127.0.0.1:18888
```

주의:

1. `OPENCLAW_MODE=mock`부터 먼저 검증하세요.
2. `OPENCLAW_MODE=http`로 전환할 때 `OPENCLAW_BASE_URL`은 NAS에서 실제로 접근 가능한 주소여야 합니다.
3. 개발 PC의 `adb forward`로 연 포트(`127.0.0.1:18888`)는 NAS에서 접근 불가입니다.

## 3) 프로젝트 실행 방식 선택

## 3-A) DSM 7.2+ (Container Manager)

1. DSM > `Container Manager` 실행
2. 좌측 `프로젝트(Project)` 클릭
3. `생성(Create)` 클릭
4. `기존 docker-compose.yml 사용` 선택
5. 경로로 `.../ourhangout-backend/docker-compose.yml` 지정
6. 프로젝트 이름 지정 (예: `ourhangout-backend`)
7. 배포(Deploy)

## 3-B) DSM 7.1.x (Docker 패키지 + SSH)

DSM 7.1 기본 `docker-compose`는 Compose v1이라 아래 제한이 있습니다.

1. `service_completed_successfully` 조건 미지원
2. 호스트 포트 충돌 가능 (`5432`, `6379`)

권장 수정:

1. `docker-compose.yml`에서 `api.depends_on.migrate` 블록 제거
2. `postgres`, `redis` 서비스의 `ports` 블록 제거
3. `logs` 폴더 생성: `mkdir -p /volume1/docker/ourhangout-backend/logs`

실행 순서(SSH root):

```bash
cd /volume1/docker/ourhangout-backend
docker-compose build
docker-compose up -d postgres redis
docker-compose run --rm migrate
docker-compose up -d api
docker-compose ps
```

## 4) 정상 기동 확인

정상 컨테이너 상태:

1. `ourhangout-migrate` -> 성공 후 종료(Exited: 0) 또는 `run --rm` 실행 성공
2. `ourhangout-api` -> Running
3. `ourhangout-postgres` -> Running
4. `ourhangout-redis` -> Running

로그 확인 포인트:

1. `ourhangout-migrate` 로그에서 migration 성공
2. `ourhangout-api` 로그에서 서버 listening 메시지

## 5) API 동작 확인 (PC에서)

```bash
curl -s http://<NAS_IP>:3000/health
curl -s http://<NAS_IP>:3000/ready
```

Swagger 문서:

- `http://<NAS_IP>:3000/docs`

## 6) 초기 계정 시드(선택)

API 컨테이너 터미널에서:

```bash
node dist/scripts/seed.js
```

기본 계정:

1. `parent@ourhangout.local / Parent123!`
2. `child@ourhangout.local / Child123!`

## 7) OpenClaw 연동 전환 순서

권장 순서:

1. `mock` 모드로 기능 먼저 검증
2. 이후 `http` 모드 전환

```env
OPENCLAW_MODE=http
OPENCLAW_BASE_URL=http://<OPENCLAW_DEVICE_IP>:18888
OPENCLAW_TIMEOUT_MS=3000
OPENCLAW_RETRY_COUNT=2
```

중요:

1. NAS가 `<OPENCLAW_DEVICE_IP>:18888`에 실제 TCP 접근 가능해야 합니다.
2. 접근 불가 시 `/ready`가 503이 될 수 있고, API 로그에 `OPENCLAW_UPSTREAM_ERROR`가 남습니다.

## 8) 운영 보안 권장

1. `JWT_SECRET`, DB 비밀번호를 강하게 설정
2. `CORS_ORIGINS`를 실제 앱 도메인만 허용
3. 외부 공개 시 443(HTTPS) 리버스 프록시 사용
4. 기본 상태에서 DB/Redis 포트 외부 노출이 필요 없으면 compose에서 `5432`, `6379` 포트 매핑 제거 권장

## 9) 백업 포인트

필수 백업 대상:

1. `.env` 파일
2. PostgreSQL 볼륨(`postgres_data`)
3. Redis 볼륨(`redis_data`)
4. 프로젝트 폴더 전체

권장:

1. 주기적 DB dump + NAS 스냅샷 병행

## 10) 업데이트 절차

1. 새 코드로 프로젝트 파일 교체(또는 git pull)
2. Container Manager에서 프로젝트 재배포(재빌드)
3. `ourhangout-migrate` 성공 여부 확인
4. `/health`, `/ready` 재검증

---

## 빠른 체크리스트

1. `.env` 생성/수정 완료
2. Container Manager 프로젝트 생성 완료
3. `migrate/api/postgres/redis` 상태 정상
4. `/health`, `/ready` 정상
5. `mock` 모드 메시지 왕복 확인
6. 필요 시 `http` 모드로 전환 후 OpenClaw 연결 확인
