# AWS 웹 콘솔 초보 가이드 (OurHangout 배포용)

이 문서는 **AWS를 처음 쓰는 사람** 기준으로, 웹에서 계정 생성부터 보안/비용 설정, Lightsail 배포 시작까지 정리한 가이드입니다.

## 0) 시작 전에 준비물

1. 이메일 주소 1개 (계정 소유용)
2. 휴대폰 (SMS/전화 인증 + MFA 앱 설치용)
3. 결제카드 1개
4. 사용할 PC 브라우저 (Chrome/Firefox 최신 권장)

## 1) AWS 계정 만들기 (웹)

1. 가입 페이지 접속  
   `https://portal.aws.amazon.com/billing/signup`
2. 이메일/계정명 입력
3. 결제 정보 입력
4. 휴대폰 본인 인증 (문자/전화 코드)
5. Support Plan 선택: **Basic(무료)** 선택
6. 가입 완료 후 활성화 메일 수신 확인

참고:
- 가입 필수 정보(이메일/계정명/주소/전화)는 AWS Account Management 공식 문서 기준입니다.
- 신규 Free Tier 정책은 계정 생성 시점에 따라 다릅니다.  
  **2025-07-15 이후 신규 계정**은 Free plan + 크레딧 정책(최대 $200) 기준으로 안내됩니다.

## 2) 첫 로그인 (Root user)

1. `https://console.aws.amazon.com/` 접속
2. `Root user` 선택
3. 가입한 이메일/비밀번호로 로그인

주의:
- Root는 권한이 가장 강합니다.
- 초기 보안 작업 끝나면 Root는 거의 쓰지 않는 게 원칙입니다.

## 3) 바로 해야 할 보안 설정 (필수)

### 3-1. Root MFA 켜기

1. 우상단 계정 메뉴 > `Security credentials`
2. `Multi-Factor Authentication (MFA)` > `Assign MFA device`
3. `Authenticator app` 선택
4. 휴대폰 OTP 앱(예: Google Authenticator, Microsoft Authenticator)으로 QR 스캔
5. 6자리 코드 2개 입력 후 활성화

권장:
- MFA 복구 리스크 줄이려면 보조 MFA도 준비
- Root access key는 만들지 않기

### 3-2. 일상용 관리자 계정 만들기 (IAM Identity Center 권장)

AWS 공식 권장 흐름:
- Root로 매일 작업하지 말고
- IAM Identity Center 사용자(관리자 권한) 만들어서 그 계정으로 운영

빠른 순서:
1. IAM Identity Center 콘솔 열기
2. `Enable` (필요 시 Organizations 자동 생성)
3. `Users` > `Add user`
4. `Groups` 생성 (예: `Admin team`)
5. AWS account에 그룹 할당 + `AdministratorAccess` permission set 부여
6. 이메일 초대 수락 후 해당 사용자로 로그인

## 4) 과금 사고 방지 설정 (필수)

## 4-1. Free Tier 알림 켜기

1. Billing 콘솔: `https://console.aws.amazon.com/costmanagement/`
2. `Billing preferences`
3. `Receive AWS Free Tier usage alerts` 활성화
4. 추가 알림 메일 주소 등록

## 4-2. 예산(Budget) 생성

1. Billing 콘솔 > `Budgets` > `Create budget`
2. `Cost budget` 선택
3. 월 예산 예시: `10 USD` (테스트 단계)
4. 경보 임계값: 50%, 80%, 100%
5. 알림 이메일 지정

## 4-3. CloudWatch 청구 경보(추가 안전장치)

1. Billing preferences에서 `Receive CloudWatch Billing Alerts` 활성화
2. CloudWatch 콘솔에서 청구 경보 생성
3. Region은 반드시 `US East (N. Virginia)`에서 생성
4. Metric: `Billing -> Total Estimated Charge`
5. 임계값 예시: `5 USD`, `10 USD`

## 5) 리전(Region) 선택 기준

처음은 하나만 고정하세요.

권장:
1. 한국/아시아 사용자 중심이면 `ap-northeast-2 (Seoul)` 우선 검토
2. Lightsail, 원하는 서비스 제공 여부 확인
3. 이후 모든 리소스를 같은 리전에 생성(초기 운영 단순화)

## 6) OurHangout용 최소 배포 시작 (Lightsail)

### 6-1. 인스턴스 생성

1. Lightsail 콘솔: `https://lightsail.aws.amazon.com/`
2. `Create instance`
3. Linux/Unix + Ubuntu LTS
4. 플랜은 테스트면 보통 `$5` 또는 `$7`부터
5. 인스턴스 생성

### 6-2. 고정 IP(Static IP) 붙이기

1. Lightsail 좌측 `Networking`
2. `Create static IP`
3. 생성 후 인스턴스에 연결

이유:
- 재시작 시 공인 IP가 바뀌는 문제 방지

### 6-3. 방화벽 포트 열기

인스턴스 > `Networking` 탭에서 인바운드 규칙 추가:
1. `22` (SSH)
2. `3000` (테스트 API 포트)
3. 운영 전환 시 `80`, `443` 권장

### 6-4. 서버 접속 후 Docker 배포

이미 만든 백엔드 기준:
1. SSH 접속
2. Docker/Docker Compose 설치
3. `ourHangout-server` 코드 클론
4. `.env` 작성
5. `docker compose up -d --build`
6. `/health`, `/ready` 확인

상세 배포 절차는 기존 문서 참고:
- `docs/AWS_DEPLOY.md`
- `docs/AWS_FREE_LOW_COST_GUIDE_KO.md`

## 7) 초보가 가장 많이 실수하는 포인트

1. Root 계정으로 계속 작업함 -> 보안 위험
2. MFA 미설정 -> 계정 탈취 리스크
3. Budget/알림 미설정 -> 과금 사고
4. 리전이 섞임 -> 리소스 찾기/비용 추적 혼란
5. Lightsail에 static IP 미부착 -> IP 변경으로 접속 끊김

## 8) 30분 체크리스트

1. AWS 가입/로그인 완료
2. Root MFA 완료
3. IAM Identity Center 관리자 사용자 생성 완료
4. Free Tier 알림 + Budget + Billing Alarm 완료
5. Lightsail 인스턴스 1대 + static IP 완료

이 5개만 끝나면, 이후 OurHangout 배포는 기술 작업으로 넘어가면 됩니다.

---

## 공식 참고 링크

- AWS 가입 완료 가이드:  
  https://aws.amazon.com/free/complete-signup/
- 신규 Free Tier 정책(2025-07-15 이후):  
  https://aws.amazon.com/about-aws/whats-new/2025/07/aws-free-tier-credits-month-free-plan/
- AWS 계정 생성 사전 준비물:  
  https://docs.aws.amazon.com/accounts/latest/reference/getting-started-prerequisites.html
- Root MFA 활성화(콘솔):  
  https://docs.aws.amazon.com/IAM/latest/UserGuide/enable-virt-mfa-for-root.html
- Root 보안 모범사례:  
  https://docs.aws.amazon.com/IAM/latest/UserGuide/root-user-best-practices.html
- 관리자 사용자 생성 권장(IAM Identity Center):  
  https://docs.aws.amazon.com/accounts/latest/reference/getting-started-step4.html
- IAM Identity Center 관리자 접근 설정 튜토리얼:  
  https://docs.aws.amazon.com/singlesignon/latest/userguide/quick-start-default-idc.html
- Billing preferences (Free Tier alert / Billing alert):  
  https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/billing-pref.html
- Budgets 생성:  
  https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-create.html
- CloudWatch 청구 경보:  
  https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/monitor_estimated_charges_with_cloudwatch.html
- Lightsail 인스턴스 생성:  
  https://docs.aws.amazon.com/lightsail/latest/userguide/getting-started-with-amazon-lightsail.html
- Lightsail Static IP:  
  https://docs.aws.amazon.com/lightsail/latest/userguide/lightsail-create-static-ip.html
- Lightsail 방화벽/포트:  
  https://docs.aws.amazon.com/lightsail/latest/userguide/understanding-firewall-and-port-mappings-in-amazon-lightsail.html
