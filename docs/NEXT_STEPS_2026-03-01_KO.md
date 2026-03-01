# OurHangout Backend 인수인계 메모 (2026-03-01)

이 문서는 오늘 진행 상태와 내일 이어서 할 작업을 정리한 핸드오프 문서입니다.

## 1) 오늘 완료된 상태

1. Synology NAS(DSM 7.1.1)에서 Docker 기반 백엔드 기동 성공
2. 컨테이너 상태 확인 완료
   - `ourhangout-api` Up
   - `ourhangout-postgres` Up (healthy)
   - `ourhangout-redis` Up (healthy)
3. 헬스체크 확인 완료
   - `GET /health` -> success true
   - `GET /ready` -> success true
4. 시드 계정 로그인 확인 완료
   - `parent@ourhangout.local / Parent123!`
5. Synology 배포 가이드를 DSM 7.1/7.2 분기 포함으로 업데이트

## 2) DSM 7.1에서 확인된 주의사항

1. `docker-compose` v1은 `service_completed_successfully` 미지원
2. NAS에서 `5432` 포트 충돌 가능
3. `api` 컨테이너 시작 전 `logs` 디렉토리가 필요 (`./logs:/app/logs`)
4. docker 소켓 권한 부족 시 `sudo -i` 또는 `docker` 그룹 권한 필요

## 3) 재기동 표준 명령 (DSM 7.1)

```bash
cd /volume1/docker/ourhangout-backend
docker-compose up -d postgres redis
docker-compose run --rm migrate
docker-compose up -d api
docker-compose ps
```

헬스체크:

```bash
curl -s http://localhost:3000/health
curl -s http://localhost:3000/ready
```

## 4) 내일 바로 이어서 할 작업 (우선순위)

1. 앱 연동 1차
   - 앱 API Base URL을 `http://<NAS_IP>:3000`으로 설정
   - 로그인/방목록/메시지 조회 호출 확인
2. 인앱 봇 대화 검증
   - `GET /v1/bots`
   - `POST /v1/bots/:botId/rooms`
   - `POST /v1/chats/rooms/:roomId/messages`
   - `GET /v1/chats/rooms/:roomId/messages`
3. OpenClaw 실연동 준비
   - 현재 `OPENCLAW_MODE=mock`
   - 실제 장치 IP가 NAS에서 접근 가능할 때 `OPENCLAW_MODE=http` 전환
4. 보안 정리
   - `JWT_SECRET` 강도 확인
   - `CORS_ORIGINS`를 실제 앱 도메인/주소로 제한
5. 운영 안정화
   - NAS 재부팅 후 자동 기동 확인
   - 주기 백업(볼륨 + `.env`) 정책 확정

## 5) 다음에 필요한 핵심 API 테스트 예시

로그인:

```bash
curl -s -X POST http://localhost:3000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"parent@ourhangout.local","password":"Parent123!"}'
```

봇 목록:

```bash
curl -s http://localhost:3000/v1/bots \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

## 6) 남은 TODO

1. DSM 7.1 환경용 compose 오버라이드 파일(`docker-compose.synology71.yml`) 추가 검토
2. NAS 리버스 프록시 + HTTPS(443) 구성
3. Google 로그인 운영 설정 (`GOOGLE_CLIENT_ID`) 적용
4. OpenClaw `http` 모드 네트워크 경로 검증
