2. 프로젝트 외부 서비스 가입 및 활용 정보
2.1 외부 서비스 요약
서비스	사용 목적	필요한 정보
Kakao Developers	카카오 로그인, 카카오 Local API, 카카오맵	REST API Key, JavaScript Key, Client Secret
Naver Developers	네이버 로그인	Client ID, Client Secret
AWS	영상·썸네일 Object Storage	Access Key, Secret Key, Bucket, Region
SSAFY GMS 또는 Gemini API	채팅 위험 문맥 분석	API Key, Model, Base URL
Expo/EAS	Android Development/Production Build	Expo 계정, Project 권한, Android 서명키
GitLab	소스 관리, Jenkins Checkout	프로젝트 권한 또는 Deploy Key
Jenkins	Backend·AI CI/CD	관리자 계정, SCM Credential, Secret Text
Mattermost	배포 결과 알림	Incoming Webhook, Jenkins Plugin 설정
EC2/DNS/TLS	운영 서버와 공개 도메인	서버 접근키, DNS 권한, TLS 인증서

2.2 Kakao Developers
사용 기능
카카오 로그인 REST API
카카오 사용자 정보 조회
카카오 Local 장소 검색
카카오맵 JavaScript SDK
가입 및 애플리케이션 생성
Kakao Developers에 카카오 계정으로 로그인한다.
개발자 등록을 완료한다.
애플리케이션을 생성한다.
앱의 REST API Key와 JavaScript Key를 확인한다.
카카오 로그인을 활성화한다.
Redirect URI와 동의 항목을 등록한다.
카카오 REST 로그인은 REST API Key, 로그인 활성화, Redirect URI, 동의 항목 설정이 필요하다. 카카오 로그인 REST API 문서
필요한 키
키	사용 위치	공개 여부
REST API Key	Frontend OAuth Client ID, Backend Local API	앱 번들에서 확인 가능
JavaScript Key	Frontend 카카오맵 WebView	앱 번들에서 확인 가능
Client Secret	Backend 토큰 교환	비공개

환경변수 연결:
카카오 REST API Key
├── Frontend: EXPO_PUBLIC_KAKAO_REST_API_KEY
├── Backend: KAKAO_REST_API_KEY
└── Jenkins: waggle-kakao-rest-api-key

카카오 JavaScript Key
└── Frontend: EXPO_PUBLIC_KAKAOMAP_APPKEY

카카오 Client Secret
├── Backend: KAKAO_CLIENT_SECRET
└── Jenkins: waggle-kakao-client-secret
카카오 REST API Key의 Client Secret 기능은 기본 활성화될 수 있으며, 활성화 상태에서는 토큰 요청에 client_secret이 필요하다. 카카오 로그인 사전 설정
카카오 로그인 설정
Redirect URI:
https://i15a606.p.ssafy.io/oauth/callback/kakao
필요한 설정:
카카오 로그인 활성화
REST API Key에 Redirect URI 등록
Client Secret 활성 여부 확인
사용자 식별자 제공
이메일을 사용할 경우 카카오계정 이메일 동의 항목 설정
Backend는 다음 API를 호출한다.
POST https://kauth.kakao.com/oauth/token
GET  https://kapi.kakao.com/v2/user/me
Frontend에서 state를 난수로 생성하며, 인증 후 인가 코드를 Backend에 전달한다.
카카오맵 설정
Frontend/src/components/home/kakaoMapHtml.ts는 WebView의 문서 주소를 https://localhost로 사용한다.
카카오 콘솔에서 JavaScript Key의 허용 도메인에 다음 값을 등록한다.
https://localhost
카카오맵 JavaScript SDK는 JavaScript Key와 등록된 도메인을 기준으로 사용한다. 카카오 지도 Web API 가이드
확인 항목
[ ] REST API Key와 JavaScript Key를 구분했다.
[ ] 카카오 로그인을 활성화했다.
[ ] Redirect URI가 한 글자도 다르지 않다.
[ ] Client Secret 활성 상태와 Backend 설정이 일치한다.
[ ] 이메일 동의 항목을 확인했다.
[ ] JavaScript SDK 도메인에 https://localhost를 등록했다.
2.3 Naver Developers
사용 기능
네이버 로그인 OAuth 2.0
네이버 회원 식별자 및 이메일 조회
가입 및 애플리케이션 생성
NAVER Developers에 로그인한다.
네이버 로그인 API 이용 신청을 진행한다.
애플리케이션을 생성한다.
로그인 오픈 API 서비스 환경에 PC웹 또는 모바일웹을 추가한다.
서비스 URL과 Callback URL을 등록한다.
Client ID와 Client Secret을 발급받는다.
네이버 로그인은 OAuth 2.0을 기반으로 제공된다. 네이버 로그인 안내
설정값
서비스 URL:
https://i15a606.p.ssafy.io

Callback URL:
https://i15a606.p.ssafy.io/oauth/callback/naver
Android 환경만 등록하면 Callback URL 입력이 불가능할 수 있으므로 이 프로젝트 구조에서는 웹 환경을 등록한다.
환경변수 연결:
Client ID
├── Frontend: EXPO_PUBLIC_NAVER_CLIENT_ID
├── Backend: NAVER_CLIENT_ID
└── Jenkins: waggle-naver-client-id

Client Secret
├── Backend: NAVER_CLIENT_SECRET
└── Jenkins: waggle-naver-client-secret
Backend 호출 주소:
GET https://nid.naver.com/oauth2.0/token
GET https://openapi.naver.com/v1/nid/me
사용자 정보 응답에서 id와 email을 읽는다. 이메일이 필요하면 네이버 애플리케이션의 제공 정보 설정과 검수 상태를 확인한다.
2.4 AWS S3
사용 목적
원본 영상 Presigned PUT 업로드
AI Worker의 원본 영상 다운로드
얼굴 블러 영상 업로드
썸네일 업로드
처리 영상·썸네일 Presigned GET 다운로드
업로드 완료 여부 확인을 위한 HeadObject
현재 운영 설정:
항목	값
Bucket	waggle-waggle
Region	ap-northeast-2
업로드 URL 만료	600초
다운로드 URL 만료	600초
최대 원본 영상	100MB

Presigned URL은 사용자에게 AWS 자격증명을 주지 않고 제한된 시간 동안 특정 객체의 업로드·다운로드 권한을 제공한다. AWS S3 Presigned URL 문서
AWS 계정 및 IAM 준비
AWS 계정에 로그인한다.
서울 리전에서 S3 Bucket을 생성하거나 기존 Bucket 권한을 받는다.
Backend와 AI 전용 IAM 사용자 또는 역할을 만든다.
최소 권한 정책을 부여한다.
Access Key를 발급한다.
Jenkins Credentials에 저장한다.
예시 최소 권한 정책:
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "WaggleObjectAccess",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:AbortMultipartUpload"
      ],
      "Resource": "arn:aws:s3:::waggle-waggle/*"
    }
  ]
}
실제 Bucket 암호화 방식과 Bucket Policy에 따라 KMS 권한 등이 추가로 필요할 수 있다.
Jenkins Credential
ID	종류	값
waggle-aws-access-key-id	Secret Text	AWS Access Key ID
waggle-aws-secret-access-key	Secret Text	AWS Secret Access Key

Backend와 AI Job이 같은 Credential을 사용한다.
CORS
Android 네이티브 요청은 브라우저 CORS의 직접 적용 대상이 아니지만, Frontend 웹 빌드에서 Presigned URL을 사용하려면 Bucket CORS에 실제 웹 Origin과 GET, PUT, HEAD를 허용해야 한다. AWS S3 CORS 안내
2.5 SSAFY GMS 및 Gemini
현재 프로젝트 설정
GEMINI_MODEL=gemini-2.5-flash-lite
GEMINI_BASE_URL=https://gms.ssafy.io/gmsapi/generativelanguage.googleapis.com
현재 코드는 SSAFY GMS 프록시를 통해 Gemini API를 호출하도록 되어 있다.
필요한 정보
항목	설명
GEMINI_API_KEY	GMS에서 발급된 API Key
GEMINI_MODEL	gemini-2.5-flash-lite
GEMINI_BASE_URL	GMS 프록시 주소
Timeout	기본 10초
Retry	최초 1회 + 재시도 2회

Jenkins Credential:
waggle-ai-gemini-api-key
Gemini Key는 waggle-ai-worker에만 주입한다. Frontend나 Backend에는 전달하지 않는다.
직접 Google Gemini API를 사용할 경우
GMS 대신 Google Gemini API를 직접 사용하려면:
Google AI Studio 또는 Google Cloud 프로젝트를 준비한다.
Gemini API Key를 발급한다.
GEMINI_BASE_URL을 비워 Google 기본 주소를 사용한다.
모델 지원 여부와 호출 형식을 다시 검증한다.
기존 GMS Key와 혼용하지 않는다.
Google은 API Key를 환경변수에 보관하고 클라이언트 앱에 포함하지 않도록 안내한다. Gemini API Key 관리 문서
2.6 Expo/EAS
사용 목적
Android Development Client APK 생성
Preview 내부 배포
Production 빌드
Android 서명키 관리
계정 준비
Expo 계정을 생성한다.
현재 EAS 프로젝트의 Owner 또는 Member에게 초대받는다.
EAS CLI에서 로그인한다.
eas login
eas whoami
현재 연결 정보:
Slug: waglewagle-mobile
Project ID: 4b468b20-9f5b-451e-8038-991c9bdf05b7
Android Package: com.waglewagle.mobile
기존 EAS 프로젝트 권한이 없다면 eas init을 바로 실행하지 않는다. 새로운 Project ID가 생성되거나 app.json이 변경될 수 있으므로 기존 프로젝트 이관 여부를 먼저 결정해야 한다.
EAS 환경변수
다음 값은 EAS Dashboard의 Project Settings → Environment variables에 등록한다.
EXPO_PUBLIC_API_BASE_URL
EXPO_PUBLIC_USE_MOCK_API
EXPO_PUBLIC_KAKAOMAP_APPKEY
EXPO_PUBLIC_KAKAO_REST_API_KEY
EXPO_PUBLIC_NAVER_CLIENT_ID
Development Build 명령:
eas build --platform android --profile development
Production Build 명령:
eas build --platform android --profile production
EAS는 Expo 계정만 있으면 Development Build를 사용할 수 있으며, Play Store 제출 시에는 별도의 Google Play 개발자 계정이 필요하다. EAS Build 공식 안내
2.7 GitLab
필요한 권한
저장소 Read 권한
Jenkins 연동 설정 권한
Webhook 생성 시 Maintainer 이상의 권한
배포 브랜치 조회 권한
저장소:
https://lab.ssafy.com/s15-webmobile1-sub1/S15P11A606.git
Jenkins Checkout 계정
권장 방식:
GitLab Read-only Deploy Key
    ↓
Jenkins의 SSH Username with private key Credential
    ↓
Pipeline script from SCM
Jenkinsfile에는 GitLab Credential ID가 선언되어 있지 않다. Checkout에 사용할 Credential은 Jenkins Job의 SCM 설정에서 별도로 지정한다.
Webhook
자동 배포가 필요하면 GitLab 프로젝트의 Webhook에서 Jenkins Endpoint를 등록한다.
Push Event 또는 승인된 배포 이벤트 선택
배포 브랜치 제한
Webhook 인증 토큰 설정
SSL 검증 유지
Jenkins에서 같은 토큰 검증
GitLab Webhook은 Push나 Merge Request 등 프로젝트 이벤트를 외부 시스템에 전달한다. GitLab Webhook 문서
2.8 Jenkins
필요한 구성
Pipeline Plugin
Git Plugin 또는 GitLab 연동 Plugin
Credentials Binding Plugin
Mattermost Notification Plugin
Docker CLI
Docker Socket 접근
Jenkins Workspace 공유
Linux Shell 실행 환경
Jenkins Credential은 대시보드의 Manage Jenkins → Credentials에서 등록한다. Jenkins는 Credential을 ID로 참조하며 암호화해 저장한다. Jenkins Credentials 안내
Backend Credential 목록
Jenkins Credential ID	종류
waggle-db-password	Secret Text
waggle-kakao-rest-api-key	Secret Text
waggle-kakao-client-secret	Secret Text
waggle-naver-client-id	Secret Text
waggle-naver-client-secret	Secret Text
waggle-jwt-secret	Secret Text
waggle-aws-access-key-id	Secret Text
waggle-aws-secret-access-key	Secret Text
waggle-rabbitmq-password	Secret Text
waggle-ai-internal-api-key	Secret Text
waggle-ai-internal-api-secret	Secret Text

AI Credential 목록
Jenkins Credential ID	종류
waggle-ai-internal-api-key	Secret Text
waggle-ai-internal-api-secret	Secret Text
waggle-ai-rabbitmq-url	Secret Text
waggle-ai-gemini-api-key	Secret Text
waggle-aws-access-key-id	Secret Text
waggle-aws-secret-access-key	Secret Text

Credential 일치 조건
Backend waggle-ai-internal-api-key
    = AI waggle-ai-internal-api-key

Backend waggle-ai-internal-api-secret
    = AI waggle-ai-internal-api-secret

Backend waggle-rabbitmq-password
    = infra/.env의 RABBITMQ_DEFAULT_PASS

AI waggle-ai-rabbitmq-url 내부 비밀번호
    = infra/.env의 RABBITMQ_DEFAULT_PASS

Backend waggle-db-password
    = infra/.env의 POSTGRES_PASSWORD
2.9 Mattermost
두 Jenkinsfile은 빌드 후 mattermostSend를 호출한다.
필요한 설정:
Mattermost 서버와 알림 채널을 준비한다.
채널의 Incoming Webhook을 생성한다.
Jenkins에 Mattermost Notification Plugin을 설치한다.
Jenkins System 설정에 Mattermost 서버 URL, Team, Channel, Webhook Token을 등록한다.
테스트 알림을 전송한다.
Mattermost Jenkins Plugin은 Incoming Webhook과 mattermostSend Pipeline Step을 지원한다. Mattermost Jenkins Plugin
전달되는 정보:
Backend 또는 AI 배포 결과
Git 브랜치
Docker 이미지 태그
Jenkins Build 번호
성공 또는 실패 로그 링크
2.10 운영 서버·DNS·TLS
저장소에서 확인되는 운영 도메인은 다음과 같다.
i15a606.p.ssafy.io
별도로 인수인계해야 할 정보:
EC2 Instance ID와 Region
SSH 사용자명
SSH Private Key 보관 위치
Security Group
Public/Private IP
DNS 관리 주체
TLS 인증서 발급 및 갱신 방식
Reverse Proxy 설정 파일
Nginx 또는 대체 Web Server 버전
Jenkins 설치 위치와 백업 경로
assetlinks.json 배포 위치
Android 서명 인증서 SHA-256 지문
이 정보는 현재 GitLab 저장소만으로 확인할 수 없다.
2.11 비밀정보 관리 기준
정보	저장 위치
DB·RabbitMQ·Grafana 비밀번호	운영 서버의 Git 제외 .env
OAuth Client Secret	Jenkins Credentials
AWS Access/Secret Key	Jenkins Credentials
Gemini/GMS Key	Jenkins Credentials
JWT Secret	Jenkins Credentials
내부 API 공유 키	Jenkins Credentials
Frontend 공개 Client ID·키	EAS 환경변수 또는 로컬 .env
GitLab Checkout Key	Jenkins SCM Credential
Android Keystore	EAS Credentials 또는 별도 비밀 저장소

금지 사항:
실제 Key를 GitLab에 커밋하지 않는다.
Secret을 EXPO_PUBLIC_*로 선언하지 않는다.
Jenkins Console에 Secret을 출력하지 않는다.
Presigned URL을 장기간 로그에 보관하지 않는다.
퇴사자 개인 AWS·GitLab·Expo 계정에 운영 자산을 종속시키지 않는다.
계정 이관 시 Key를 복사하는 방식보다 신규 발급 후 교체·폐기한다.