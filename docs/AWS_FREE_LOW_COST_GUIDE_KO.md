# AWS 무료/최저비용 배포 가이드 (한국어)

이 문서는 **Our Hangout Backend**를 AWS에 처음 올리는 기준으로,
"무료로 가능한지"와 "체험 단계에서 가장 저렴하게 띄우는 방법"을 정리합니다.

## 1) 결론 요약

1. AWS는 완전 상시 무료가 아니라 **크레딧/무료 구간 기반**입니다.
2. 체험 목적 최저비용은 보통 **Lightsail 단일 인스턴스**가 가장 단순하고 저렴합니다.
3. 현재 백엔드(Compose: `migrate + api + postgres + redis`)는 Lightsail 1대에 바로 올릴 수 있습니다.

## 2) 무료 사용 가능 여부 (중요)

AWS Free Tier 정책은 계정 생성 시점에 따라 다릅니다.

- 2025-07-15 이후 신규 계정:
  - 가입 시 `$100` 크레딧
  - 추가 활동 완료 시 최대 `$100` 추가 (총 최대 `$200`)
  - Free Plan은 **가입 후 6개월 또는 크레딧 소진 시 종료**
  - 크레딧 자체는 최대 12개월 유효
- 기존(2025-07-15 이전) 계정:
  - 서비스별 12개월 무료(기존 Free Tier) 규칙이 적용될 수 있음

즉, "완전 무료 고정"이 아니라 **기간/크레딧 내 무료**라고 이해하면 정확합니다.

## 3) 체험 기준 최저비용 추천 아키텍처

### 추천안 A (가장 단순/저렴)

- Amazon Lightsail 인스턴스 1대
- 그 안에서 Docker Compose로 아래 4개 실행
  - `migrate`
  - `api`
  - `postgres`
  - `redis`

장점:
- 설정이 쉽고 빠름
- 월 고정비 예측 쉬움

주의:
- 단일 서버라 장애/백업/확장성이 낮음
- 운영 서비스 장기용으로는 한계

### 인스턴스 크기 가이드

- 초저가 테스트: `$5/month` Linux/Unix 번들
- 안정성 여유: `$7/month` Linux/Unix 번들 권장

메모리 여유가 적으면 API+DB+Redis 동시 실행 시 성능 저하가 날 수 있어,
실사용 테스트는 `$7` 이상을 권장합니다.

## 4) Lightsail 배포 순서 (실행용)

## 4.1 Lightsail 생성

1. AWS 콘솔 > Lightsail > Create instance
2. Region 선택 (사용자와 가까운 리전)
3. 플랫폼: Linux/Unix, 블루프린트: Ubuntu LTS
4. 플랜: 테스트면 `$5`, 안정성은 `$7` 이상
5. SSH Key 생성/다운로드
6. 네트워크 포트 열기:
   - 22 (SSH)
   - 3000 (테스트용, 나중에 80/443 리버스프록시 권장)

## 4.2 서버 접속 및 기본 설치

```bash
ssh -i <key.pem> ubuntu@<LIGHTSAIL_PUBLIC_IP>
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu
newgrp docker
docker --version
docker compose version
```

## 4.3 코드 배포

```bash
git clone https://github.com/pdj14/ourHangout-server.git
cd ourHangout-server
cp .env.example .env
```

`.env` 필수 수정:

- `NODE_ENV=production`
- `JWT_SECRET=<긴 랜덤 문자열>`
- `CORS_ORIGINS=<실제 앱 도메인/주소>`
- `OPENCLAW_MODE` / `OPENCLAW_BASE_URL`
- (ALB/프록시 뒤면) `TRUST_PROXY=true`

## 4.4 컨테이너 기동

```bash
docker compose up -d --build
```

정상 기준:
- `ourhangout-migrate` 컨테이너: 성공 후 Exit
- `ourhangout-api`, `postgres`, `redis`: Running

```bash
docker compose ps
curl -s http://localhost:3000/health
curl -s http://localhost:3000/ready
```

## 4.5 시드 계정 (테스트용)

```bash
docker compose exec api node dist/scripts/seed.js
```

## 5) 비용 절약 체크리스트

1. 초기에는 Load Balancer, NAT Gateway, RDS를 붙이지 않는다.
2. 로그 저장 기간을 짧게 운영한다.
3. 스냅샷 주기를 주 1회 정도로 최소 시작한다.
4. 테스트 안 할 때 인스턴스를 중지해 비용을 줄인다.
5. 트래픽/디스크 급증 알람(예산 알람)을 먼저 건다.

## 6) 언제 AWS 정식 구조(ECS/RDS/ElastiCache)로 가야 하나?

아래 중 2개 이상이면 전환 권장:

1. 동시 접속이 늘어 단일 인스턴스 CPU/메모리 한계가 보임
2. 배포 중 무중단이 필요함
3. DB 백업/복구 SLA가 중요함
4. 장애 시 자동 복구가 필요함

그때는 `docs/AWS_DEPLOY.md`의 확장 아키텍처(ALB + ECS/EC2 + RDS + ElastiCache)로 이동하면 됩니다.

## 7) OpenClaw 관련 주의 (클라우드에서 가장 중요)

AWS에서 로컬 네트워크 OpenClaw를 직접 호출하기 어렵습니다.
장기적으로는 아래 중 하나가 필요합니다.

1. VPN/Tailscale/WireGuard로 AWS와 디바이스 네트워크 연결
2. (권장) OpenClaw 디바이스가 백엔드로 outbound 연결(WebSocket/MQTT)

---

## 참고 링크 (공식)

- AWS Free Tier 업데이트 (최대 $200 크레딧, Free Plan 6개월):
  - https://aws.amazon.com/about-aws/whats-new/2025/07/aws-free-tier-credits-month-free-plan
- AWS Free Tier Terms (2025-07-09 개정):
  - https://aws.amazon.com/free/terms/
- EC2 Free Tier (계정 생성 시점별 차이 문서):
  - https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-free-tier-usage.html
- Amazon Lightsail Pricing:
  - https://aws.amazon.com/lightsail/pricing/
- Amazon RDS Free Tier:
  - https://aws.amazon.com/rds/free/
