# Synology NAS 배포 가이드 (DSM 7.x, 초보자용)

이 문서는 `ourhangout-backend`를 Synology NAS에 배포하는 가장 단순한 절차를 설명합니다.

## 0) 목표와 전제

1. 목표: NAS에서 `api + postgres + redis`를 Docker Compose로 기동 (`api`가 listen 전에 migration 실행)
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
DATABASE_URL=postgresql://ourhangout:<같은 비밀번호를 URI 인코딩>@postgres:5432/ourhangout
PUBLIC_BASE_URL=https://<외부에서 접근할 API 도메인>
CORS_ORIGINS=http://<APP_HOST_OR_DOMAIN>
```

주의:

1. `PUBLIC_BASE_URL`은 앱이 실제로 접근할 수 있는 HTTPS 주소를 사용하세요.
2. `DATABASE_URL` 비밀번호는 `POSTGRES_PASSWORD`와 같아야 하며 특수문자는 URI 인코딩해야 합니다.

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

현재 compose는 별도 migrate service와 `service_completed_successfully`를 사용하지 않아 Compose v1에서도
동일 파일을 사용합니다. PostgreSQL/Redis 호스트 포트도 기본적으로 공개하지 않습니다.

최초 실행(SSH root):

```bash
cd /volume1/docker/ourhangout-backend
mkdir -p logs storage/media storage/app-updates
docker-compose up -d --build
docker-compose ps
```

Git clone으로 설치한 서버 업데이트는 중복 데이터 preflight, API 안전 중지, migration, health 확인을
한 번에 수행하는 `sh scripts/deploy-main.sh`를 권장합니다.

## 4) 정상 기동 확인

정상 컨테이너 상태:

1. `ourhangout-api` -> Running (시작 로그에서 migration 완료 후 listening)
2. `ourhangout-postgres` -> Running
3. `ourhangout-redis` -> Running

로그 확인 포인트:

1. `ourhangout-api` 로그에서 migration 성공
2. 이어서 서버 listening 메시지

## 5) API 동작 확인 (PC에서)

```bash
curl -s http://<NAS_IP>:3000/health
curl -s http://<NAS_IP>:3000/ready
```

Swagger 문서(운영 기본 비활성화, 명시적으로 `SWAGGER_ENABLED=true`인 환경만):

- `http://<NAS_IP>:3000/docs`

## 6) 초기 계정

개발 seed는 문서화된 공용 비밀번호를 사용하므로 production에서 의도적으로 거부됩니다. 운영에서는
일반 가입/Google 로그인 후 Guardian Console에서 필요한 역할을 관리합니다. production 컨테이너에서
아래 명령을 실행하지 마세요.

과거 버전에서 seed를 실행한 운영 DB라면 `parent@ourhangout.local`과 `child@ourhangout.local` 계정을
반드시 제거하거나 비밀번호를 변경하고 기존 세션을 폐기합니다.

```bash
node dist/scripts/seed.js
```

## 7) 운영 보안 권장

1. `JWT_SECRET`, DB 비밀번호를 강하게 설정
2. `CORS_ORIGINS`를 실제 앱 도메인만 허용
3. 외부 공개 시 443(HTTPS) 리버스 프록시 사용
4. 기본 상태에서 DB/Redis 포트 외부 노출이 필요 없으면 compose에서 `5432`, `6379` 포트 매핑 제거 권장

## 8) 백업 포인트

필수 백업 대상:

1. `.env` 파일
2. PostgreSQL 볼륨(`postgres_data`)
3. Redis 볼륨(`redis_data`)
4. 프로젝트 폴더 전체

권장:

1. 주기적 DB dump + NAS 스냅샷 병행

## 9) 업데이트 절차

1. DB backup과 감사 문서의 migration 중복 쿼리 확인
2. Git clone에서는 `sh scripts/deploy-main.sh` 실행
3. 파일 업로드 방식이면 Container Manager에서 프로젝트 재빌드/재배포
4. API 로그의 migration 성공과 `/health`, `/ready` 재검증

---

## 빠른 체크리스트

1. `.env` 생성/수정 완료
2. Container Manager 프로젝트 생성 완료
3. `api/postgres/redis` 상태 정상
4. `/health`, `/ready` 정상
5. 사용자 간 메시지 왕복 확인
