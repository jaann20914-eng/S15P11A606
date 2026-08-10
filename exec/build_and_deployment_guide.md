1. GitLab 소스 클론 이후 빌드 및 배포 가이드
1.1 문서 개요
이 문서는 와글와글 프로젝트를 GitLab에서 클론한 뒤 Backend, AI, Frontend 및 인프라 서비스를 빌드·배포하는 데 필요한 정보를 정리한다.
검토 기준 정보는 다음과 같다.
항목	값
GitLab 저장소	https://lab.ssafy.com/s15-webmobile1-sub1/S15P11A606.git
Backend	Spring Boot
AI API	FastAPI
AI Worker	Python 비동기 Worker
Frontend	Expo 기반 React Native
운영 방식	Docker + Jenkins
운영 도메인	https://i15a606.p.ssafy.io
공용 Docker 네트워크	waggle-network

Jenkins 파이프라인에는 배포 브랜치가 고정되어 있지 않다. 실제 배포 브랜치는 Jenkins Job의 SCM 설정으로 결정한다.

1.2 시스템 구성
React Native 앱
    │
    │ HTTPS / WSS
    ▼
공개 도메인 및 Reverse Proxy
    │
    ├── /api/**                → Backend : 127.0.0.1:8990
    ├── /oauth/callback/**     → Backend : 127.0.0.1:8990
    └── /ws                    → Backend WebSocket : 127.0.0.1:8990

Backend
    ├── PostGIS        : waggle-postgis:5432
    ├── Elasticsearch  : waggle-elasticsearch:9200
    ├── RabbitMQ       : waggle-rabbitmq:5672
    ├── AI API         : waggle-ai:8000
    └── AWS S3

AI Worker
    ├── RabbitMQ
    ├── AWS S3
    ├── Gemini/GMS
    └── Backend 내부 콜백
Backend와 AI는 외부에 직접 공개하지 않고 호스트의 127.0.0.1에만 바인딩한다. 컨테이너 간 통신은 waggle-network에서 컨테이너 이름으로 수행한다.
1.3 사용 제품 및 버전
Backend
구분	제품 및 버전	확인 파일
JVM	Java 21	Backend/build.gradle
빌드 JVM 이미지	eclipse-temurin:21-jdk	Backend/Dockerfile, Jenkinsfile
운영 JVM 이미지	eclipse-temurin:21-jre	Backend/Dockerfile
Framework	Spring Boot 4.0.7	Backend/build.gradle
Spring Framework	7.0.8	Spring Boot 4.0.7 관리 버전
WAS	Embedded Apache Tomcat 11.0.22	Spring Boot 4.0.7 관리 버전
빌드 도구	Gradle 9.5.1	gradle-wrapper.properties
ORM	Spring Data JPA, Hibernate Spatial	Backend/build.gradle
DB 마이그레이션	Flyway	Backend/build.gradle
실시간 통신	WebSocket + STOMP 1.2	WebSocketConfig.java
캐시	Caffeine	Backend/build.gradle

Spring Boot 4.0.7이 관리하는 tomcat-embed-core 버전은 11.0.22다. Spring Boot 관리 의존성 목록
AI
구분	제품 및 버전
Python	3.12
API 서버	FastAPI + Uvicorn
설정·검증	Pydantic v2, pydantic-settings
메시징	aio-pika
AI API	google-genai
영상 처리	OpenCV, FFmpeg
얼굴 검출	InsightFace buffalo_m의 SCRFD
추론 런타임	ONNX Runtime
Object Storage	boto3
정적 검사	mypy 2.3.0, ruff 0.16.0
테스트	pytest 9.1.1

AI/requirements.txt의 운영 라이브러리는 버전이 고정되어 있지 않다. 같은 소스를 나중에 다시 빌드할 경우 다른 라이브러리 버전이 설치될 수 있으므로 완전한 재현 빌드가 필요하면 별도의 버전 고정 작업이 필요하다.

Frontend
구분	제품 및 버전
Framework	Expo SDK ~54.0.0
React Native	0.81.5
React	19.1.0
TypeScript	~5.9.2
Router	Expo Router ~6.0.21
WebView	react-native-webview 13.15.0
STOMP	@stomp/stompjs ^7.3.0
EAS CLI	21.3.0 이상
Android Application ID	com.waglewagle.mobile
Custom Scheme	waglewagle
EAS Project ID	4b468b20-9f5b-451e-8038-991c9bdf05b7

Frontend는 package-lock.json이 있으므로 의존성 설치 시 npm ci 사용을 권장한다.
데이터·메시징·모니터링
제품	버전 또는 이미지
PostgreSQL/PostGIS	postgis/postgis:16-3.5
Elasticsearch	9.2.8
RabbitMQ	rabbitmq:4-management
Prometheus	3.1.0
Grafana	11.4.0
node-exporter	1.8.2
cAdvisor	0.49.1
postgres-exporter	0.16.0
elasticsearch-exporter	1.8.0

저장소에서 확인되지 않은 버전
다음 항목은 저장소에 버전이 기록되어 있지 않다.
Ubuntu 또는 EC2 운영체제 버전
Docker Engine 및 Docker Compose 버전
Jenkins 버전
Nginx 등 외부 Reverse Proxy 버전
IntelliJ IDEA, STS, VS Code 등 IDE 버전
Node.js 및 npm 버전
Android SDK, Build Tools 버전
IDE 관련 설정은 .gitignore에서 IntelliJ IDEA, STS, NetBeans, VS Code를 모두 제외하고 있어 특정 IDE가 표준으로 지정되어 있지 않다. 인수인계를 위해서는 실제 운영 서버와 팀원 개발환경에서 다음 결과를 별도로 보관해야 한다.
java -version
docker version
docker compose version
node --version
npm --version
jenkins --version
nginx -v
1.4 소스 클론
git clone https://lab.ssafy.com/s15-webmobile1-sub1/S15P11A606.git
cd S15P11A606

# 배포 대상으로 승인된 브랜치 사용
git checkout <deploy-branch>
git pull
Private 저장소라면 다음 중 하나가 필요하다.
프로젝트 권한이 있는 GitLab 계정과 SSH Key
Jenkins 전용 Read-only Deploy Key
HTTPS 방식의 Deploy Token 또는 Personal Access Token
빌드 서버에는 개인 계정보다 Read-only Deploy Key 사용이 적합하다. GitLab Deploy Key 안내
1.5 환경변수
Frontend 환경변수
Frontend/.env.example을 기준으로 로컬 Frontend/.env를 구성한다.
EXPO_PUBLIC_API_BASE_URL=https://i15a606.p.ssafy.io
EXPO_PUBLIC_USE_MOCK_API=false

EXPO_PUBLIC_KAKAOMAP_APPKEY=<카카오 JavaScript 키>
EXPO_PUBLIC_KAKAO_REST_API_KEY=<카카오 REST API 키>
EXPO_PUBLIC_NAVER_CLIENT_ID=<네이버 Client ID>
변수	설명
EXPO_PUBLIC_API_BASE_URL	Backend 공개 URL. 끝에 /api를 붙이지 않는다.
EXPO_PUBLIC_USE_MOCK_API	true이면 서버 대신 고정 목업 데이터를 사용한다.
EXPO_PUBLIC_KAKAOMAP_APPKEY	카카오맵 JavaScript SDK 키
EXPO_PUBLIC_KAKAO_REST_API_KEY	카카오 로그인 인가 요청의 Client ID
EXPO_PUBLIC_NAVER_CLIENT_ID	네이버 로그인 인가 요청의 Client ID

EXPO_PUBLIC_* 값은 앱 번들에 포함되어 사용자가 확인할 수 있다. Client Secret, AWS Secret Key, Gemini Key는 절대 넣지 않는다.
로컬 .env는 EAS 원격 빌드 서버에 자동으로 전달되지 않을 수 있으므로 EAS 프로젝트의 development, preview, production 환경에도 같은 변수들을 등록해야 한다. EAS는 프로필에 따라 환경을 자동 선택한다. EAS 환경변수 안내
Backend 필수 환경변수
Backend에는 추적되는 .env.example이 없다. 로컬 실행 시 OS 환경변수나 IDE 실행 설정으로 다음 값을 전달해야 한다.
DB_URL=jdbc:postgresql://localhost:5432/wagglewaggle
DB_USERNAME=waggle
DB_PASSWORD=<DB 비밀번호>

ES_URIS=http://localhost:9200

RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USERNAME=waggle
RABBITMQ_PASSWORD=<RabbitMQ 비밀번호>

KAKAO_REST_API_KEY=<카카오 REST API 키>
KAKAO_CLIENT_SECRET=<카카오 Client Secret>
KAKAO_REDIRECT_URI=https://i15a606.p.ssafy.io/oauth/callback/kakao

NAVER_CLIENT_ID=<네이버 Client ID>
NAVER_CLIENT_SECRET=<네이버 Client Secret>
NAVER_REDIRECT_URI=https://i15a606.p.ssafy.io/oauth/callback/naver

OAUTH_CALLBACK_SCHEME=waglewagle

JWT_SECRET=<32바이트 이상의 충분히 긴 난수>
INTERNAL_API_KEY=<Backend가 AI 호출 시 사용할 공유 키>
INTERNAL_API_SECRET=<AI가 Backend 호출 시 사용할 공유 키>

AI_RECOMMENDATION_BASE_URL=http://localhost:8000

AWS_ACCESS_KEY_ID=<AWS Access Key ID>
AWS_SECRET_ACCESS_KEY=<AWS Secret Access Key>
AWS_S3_BUCKET=waggle-waggle
AWS_REGION=ap-northeast-2
운영 Jenkins에서는 DB, Elasticsearch, RabbitMQ, AI 주소가 다음과 같이 주입된다.
항목	운영값
DB URL	jdbc:postgresql://waggle-postgis:5432/wagglewaggle
DB 사용자	waggle
Elasticsearch	http://waggle-elasticsearch:9200
RabbitMQ	waggle-rabbitmq:5672
RabbitMQ 사용자	waggle
AI API	http://waggle-ai:8000
S3 Bucket	waggle-waggle
S3 Region	ap-northeast-2
OAuth Scheme	waglewagle

Backend 선택 환경변수는 다음과 같다.
변수	기본값	설명
AWS_S3_UPLOAD_URL_EXPIRATION_SECONDS	600	Presigned PUT URL 만료 시간
AWS_S3_DOWNLOAD_URL_EXPIRATION_SECONDS	600	Presigned GET URL 만료 시간
MAX_VIDEO_SIZE_BYTES	104857600	최대 업로드 크기 100MB
DAILY_PIN_LIMIT	0	0 이하면 일일 등록 제한 미적용
CHAT_PROFANITY_STRATEGY	dictionary	1차 비속어 필터 전략
AI_RECOMMENDATION_CONNECT_TIMEOUT_MS	1000	AI 연결 제한 시간
AI_RECOMMENDATION_READ_TIMEOUT_MS	3000	AI 응답 제한 시간
AI_BLUR_REPUBLISH_ENABLED	true	미처리 블러 작업 재발행
AI_BLUR_REPUBLISH_INTERVAL_MS	60000	재발행 검사 주기
AI_BLUR_REPUBLISH_PENDING_THRESHOLD	PT5M	지연 작업 판정 기준
AI_CHAT_ANALYSIS_ENABLED	true	채팅 분석 스케줄러
AI_CHAT_ANALYSIS_INTERVAL_MS	5000	채팅 배치 주기
AI_CHAT_REPUBLISH_ENABLED	true	채팅 작업 재발행
AI_CHAT_REPUBLISH_INTERVAL_MS	20000	재발행 검사 주기
AI_CHAT_REPUBLISH_STALE_THRESHOLD	PT10S	지연 판정 기준
AI_CHAT_REPUBLISH_MAX_RETRY_AGE	PT3M	최대 재시도 가능 시간
SPRING_JPA_OPEN_IN_VIEW	Jenkins에서 false	요청 종료 후 지연 로딩 방지

Backend/build.gradle은 .env를 test 작업에만 주입한다. bootRun이나 java -jar 실행에서는 .env가 자동으로 읽히지 않는다.

AI 환경변수
AI/.env.example을 AI/.env로 복사해 로컬 실행에 사용한다.
필수 연결 정보
INTERNAL_API_KEY=<Backend와 같은 값>
INTERNAL_API_SECRET=<Backend와 같은 값>

BACK_BASE_URL=http://localhost:8080
RABBITMQ_URL=amqp://waggle:<비밀번호>@localhost:5672/

GEMINI_API_KEY=<GMS 또는 Gemini API Key>
GEMINI_MODEL=gemini-2.5-flash-lite
GEMINI_BASE_URL=https://gms.ssafy.io/gmsapi/generativelanguage.googleapis.com

AWS_ACCESS_KEY_ID=<AWS Access Key ID>
AWS_SECRET_ACCESS_KEY=<AWS Secret Access Key>
AWS_S3_BUCKET=waggle-waggle
AWS_REGION=ap-northeast-2
AI는 STORAGE_* 이름도 지원한다.
기본 변수	지원 별칭
STORAGE_BUCKET	AWS_S3_BUCKET, S3_BUCKET_NAME
STORAGE_ACCESS_KEY	AWS_ACCESS_KEY_ID
STORAGE_SECRET_KEY	AWS_SECRET_ACCESS_KEY
STORAGE_REGION	AWS_REGION

S3 호환 스토리지를 사용하면 STORAGE_ENDPOINT_URL에 별도 Endpoint를 지정한다. AWS S3에서는 비워 둔다.
처리·제어 변수
영역	변수 및 기본값
공통	LOG_LEVEL=INFO, METRICS_PORT=9000
추천	SCORING_TIMEOUT_MS=2000
Backend 콜백	CHAT_CALLBACK_TIMEOUT_SECONDS=3.0, CHAT_CALLBACK_MAX_RETRIES=2
Gemini	GEMINI_TIMEOUT_SECONDS=10.0, CHAT_ANALYSIS_MAX_RETRIES=2
얼굴 모델	MODEL_NAME=buffalo_m, DET_THRESHOLD=0.3, DET_WIDTH=640, DET_HEIGHT=640
블러	MARGIN_RATIO=0.3, BLUR_KERNEL_SIZE=51, BLUR_ITERATIONS=2, BLUR_FEATHER_RATIO=0.3
추적	TRACKING_MAX_MISSED_FRAMES=3, TRACKING_IOU_THRESHOLD=0.3, TRACKING_SMOOTHING_ALPHA=0.3
검증	VALIDATE_INTERVAL=5, MAX_SHARPNESS_RATIO=0.6, MIN_ROI_SIZE=8

RabbitMQ Topology 기본값은 다음과 같다.
BLUR_EXCHANGE=ai.blur.exchange
BLUR_REQUEST_QUEUE=ai.blur.request
BLUR_REQUEST_ROUTING_KEY=ai.blur.request
BLUR_RESULT_QUEUE=ai.blur.result
BLUR_RESULT_ROUTING_KEY=ai.blur.result
BLUR_DLX=ai.blur.dlx
BLUR_DEAD_LETTER_QUEUE=ai.blur.dead-letter
BLUR_DEAD_LETTER_ROUTING_KEY=ai.blur.dead-letter

CHAT_EXCHANGE=ai.chat.exchange
CHAT_MESSAGE_QUEUE=ai.chat.message
CHAT_MESSAGE_ROUTING_KEY=ai.chat.message
CHAT_DLX=ai.chat.dlx
CHAT_DEAD_LETTER_QUEUE=ai.chat.dead-letter
CHAT_DEAD_LETTER_ROUTING_KEY=ai.chat.dead-letter
인프라 환경변수
infra/.env:
POSTGRES_PASSWORD=<현재 운영 DB 비밀번호>
RABBITMQ_DEFAULT_PASS=<현재 운영 RabbitMQ 비밀번호>
infra/monitoring/.env:
GRAFANA_ADMIN_PASSWORD=<Grafana admin 비밀번호>
POSTGRES_PASSWORD=<infra/.env와 같은 DB 비밀번호>
PostgreSQL과 RabbitMQ의 초기 계정 정보는 볼륨을 처음 생성할 때만 반영된다. 기존 볼륨을 재사용하면 .env의 값을 바꿔도 내부 계정 비밀번호가 변경되지 않는다.
1.6 주요 계정 및 프로퍼티 정의 파일
파일	역할
Backend/src/main/resources/application.yml	DB, RabbitMQ, Elasticsearch, OAuth, JWT, S3, AI 연결 설정
Backend/src/test/resources/application-test.yml	통합 테스트용 더미 설정
Backend/src/main/java/.../global/properties/*.java	Spring @ConfigurationProperties 바인딩
Jenkinsfile	Backend 운영값과 Jenkins Credential ID
AI/app/core/config.py	AI 환경변수, 기본값, S3 별칭
AI/.env.example	AI 로컬 환경변수 템플릿
AI/Jenkinsfile	AI 운영값과 Jenkins Credential ID
Frontend/.env.example	앱 공개 환경변수 템플릿
Frontend/src/constants/env.ts	Frontend 환경변수 단일 접근 지점
Frontend/src/utils/oauth.ts	OAuth Redirect URI와 앱 Scheme
Frontend/app.json	Android 패키지, App Link, Scheme, EAS Project ID
Frontend/eas.json	EAS 빌드 프로필
infra/docker-compose.yml	PostGIS, Elasticsearch, RabbitMQ 계정·네트워크·볼륨
infra/.env.example	DB·RabbitMQ 비밀번호 템플릿
infra/monitoring/docker-compose.yml	Grafana 및 Exporter 연결
infra/monitoring/.env.example	Grafana·PostgreSQL 모니터링 계정
infra/monitoring/prometheus/prometheus.yml	Prometheus 수집 대상

ERD의 기준이 되는 DDL은 다음 Flyway 파일이다.
Backend/src/main/resources/db/migration/
├── V1__baseline.sql
├── V2__onboarding.sql
├── V3__places_and_pins.sql
├── V4__remaining_domain_tables.sql
├── V5__pins_deleted_at.sql
├── V6__pins_id_to_uuid.sql
├── V7__credit_pin_id_and_view_transactions.sql
├── V8__ai_blur_jobs.sql
├── V9__search_histories_kakao_place_id.sql
├── V10__chat_schema_changes.sql
├── V11__view_angle_to_numeric.sql
├── V12__places_add_kakao_columns.sql
├── V13__pin_evaluations_created_at.sql
├── V14__places_category.sql
├── V15__pin_unlocks_created_at.sql
└── V16__ai_blur_jobs_final_status.sql
DB 스키마는 ddl-auto: validate이므로 애플리케이션이 테이블을 자동 생성하지 않는다. Flyway가 V1부터 순서대로 스키마를 구성하고 Hibernate는 매핑 일치 여부만 검증한다.
1.7 신규 운영 호스트 준비
운영 Docker Compose 파일은 Linux 경로와 pid: host, /sys, /var/lib/docker 등을 사용하므로 Linux 호스트가 필요하다.
필수 항목:
Git
Docker Engine
Docker Compose Plugin
Jenkins 및 Docker 접근 권한
외부 공개용 Reverse Proxy와 TLS 인증서
최소 2GB 이상의 Elasticsearch 전용 여유 메모리
GitLab 접근 자격증명
Jenkins Credentials
AWS, OAuth, GMS 계정
Expo/EAS 프로젝트 접근 권한
Docker Engine은 공식 저장소를 통한 특정 버전 설치가 재현성 측면에서 적합하다. Docker Engine Ubuntu 설치 문서
1.8 상태 저장 인프라 기동
최초 한 번 네트워크와 볼륨을 만든다.
docker network create waggle-network

docker volume create waggle-postgis-data
docker volume create waggle-elasticsearch-data
docker volume create waggle-rabbitmq-data
환경변수 파일을 준비한다.
cp infra/.env.example infra/.env
vi infra/.env
지원 서비스를 실행한다.
docker compose -f infra/docker-compose.yml up -d
docker compose -f infra/docker-compose.yml ps
컨테이너는 다음 상태가 되어야 한다.
waggle-postgis          healthy
waggle-elasticsearch    healthy
waggle-rabbitmq         healthy
운영 데이터가 들어 있는 볼륨에서는 다음 명령을 사용하지 않는다.
docker compose down -v
서비스 일시 중지는 다음 명령을 사용한다.
docker compose -f infra/docker-compose.yml stop
1.9 Backend 빌드 및 배포
로컬 검증
cd Backend

# 테스트 시 Testcontainers가 Docker를 사용한다.
./gradlew clean test --no-daemon

# 실행 JAR 생성
./gradlew clean bootJar -x test --no-daemon
Docker 이미지 생성
docker build \
  --tag wagglewaggle-backend:<commit-hash> \
  --tag wagglewaggle-backend:latest \
  Backend
Jenkins 파이프라인
루트의 Jenkinsfile을 사용하는 Pipeline Job을 만든다.
파이프라인 순서는 다음과 같다.
GitLab Checkout
Git 커밋 해시 8자리를 Docker 이미지 태그로 사용
JDK 21 컨테이너 안에서 Gradle 테스트
Backend Docker 이미지 빌드
기존 컨테이너 이미지 ID 보관
기존 waggle-backend 제거
신규 컨테이너 실행
최대 30초 동안 Started WagglewaggleApplication 로그 확인
실패하면 신규 컨테이너 제거 후 이전 이미지로 복구
Mattermost에 성공 또는 실패 알림
배포 결과:
항목	값
컨테이너	waggle-backend
이미지	wagglewaggle-backend:<commit-hash>
내부 포트	8080
호스트 포트	127.0.0.1:8990
네트워크	waggle-network
재시작 정책	unless-stopped

테스트 단계는 --volumes-from "$(hostname)"을 사용한다. Jenkins Executor가 Docker 컨테이너로 실행되고, Docker Socket 및 Workspace가 호스트와 공유되는 현재 DooD 구조를 전제로 한다. Jenkins를 호스트 프로세스로 옮기면 이 단계가 실패하므로 파이프라인 수정이 필요하다.

1.10 AI 빌드 및 배포
로컬 실행
cd AI

python -m venv .venv
pip install -r requirements.txt -r requirements-dev.txt

cp .env.example .env

mypy app/
pytest
ruff check .

uvicorn app.main:app --reload
python worker.py
Docker 검증 및 이미지 생성
docker build \
  --progress=plain \
  --target test \
  --tag wagglewaggle-ai:test \
  AI

docker build \
  --target runtime \
  --tag wagglewaggle-ai:<commit-hash> \
  --tag wagglewaggle-ai:latest \
  AI
Jenkins 파이프라인
AI/Jenkinsfile을 사용하는 별도 Pipeline Job을 만든다.
하나의 이미지에서 두 컨테이너를 실행한다.
컨테이너	명령	포트
waggle-ai	기본 CMD인 Uvicorn	내부 8000, 호스트 127.0.0.1:8991
waggle-ai-worker	python /app/worker.py	지표 9000, Docker 네트워크 내부

AI 파이프라인은 다음을 확인한다.
mypy → pytest → ruff
waggle-ai의 /health 응답
waggle-ai-worker의 RabbitMQ 연결 로그
실패 시 API와 Worker를 모두 제거하고 이전 이미지로 복구
InsightFace 모델은 waggle-insightface-models 볼륨에 저장한다. 신규 호스트의 최초 얼굴 분석 시 모델 다운로드 또는 초기화 시간이 발생할 수 있으므로 외부 네트워크와 볼륨 권한을 확인해야 한다.
1.11 Frontend 빌드
Expo Go가 아니라 EAS Development Build를 사용한다.
cd Frontend

npm ci
npx expo-doctor

eas login
eas whoami

eas build \
  --platform android \
  --profile development
EAS 프로젝트 접근 권한이 필요하며, 현재 app.json의 Project ID를 임의로 변경하면 기존 빌드·서명 정보와 연결되지 않는다. EAS Development Build는 expo-dev-client를 포함하는 내부 배포용 빌드다. EAS Build 공식 안내
JavaScript만 수정된 경우:
npx expo start -c --dev-client
다음 변경은 APK 재빌드가 필요하다.
app.json
Android 패키지명
Scheme 또는 App Link
Expo Plugin
Native Module
Android 권한
서명 인증서
1.12 모니터링 배포
cp infra/monitoring/.env.example infra/monitoring/.env
vi infra/monitoring/.env

docker compose \
  -f infra/monitoring/docker-compose.yml \
  up -d
SSH 터널:
ssh -N \
  -L 3000:127.0.0.1:3000 \
  -L 9091:127.0.0.1:9091 \
  ubuntu@<EC2-퍼블릭-IP>
접속 주소:
Grafana: http://localhost:3000
Prometheus: http://localhost:9091
Prometheus 수집 대상:
Prometheus
EC2 Node Exporter
cAdvisor
RabbitMQ
Spring Boot Actuator
PostgreSQL Exporter
Elasticsearch Exporter
AI API
AI Worker
1.13 Reverse Proxy 및 App Link 요구사항
저장소에는 실제 Nginx 설정과 버전이 없다. 공개 배포를 재현하려면 운영 서버에서 다음 설정을 별도로 백업해야 한다.
공개 경로	연결 대상	추가 조건
/api/**	127.0.0.1:8990	일반 HTTP Proxy
/oauth/callback/**	127.0.0.1:8990	Backend가 앱 Scheme으로 302 반환
/ws	127.0.0.1:8990	WebSocket Upgrade Header 전달
/.well-known/assetlinks.json	정적 파일	Android 인증서 SHA-256 포함

현재 Backend의 OAuth Callback Controller는 다음 주소를 앱 Scheme으로 변환한다.
https://i15a606.p.ssafy.io/oauth/callback/kakao
→ waglewagle://oauth/callback/kakao

https://i15a606.p.ssafy.io/oauth/callback/naver
→ waglewagle://oauth/callback/naver
따라서 /oauth/callback/**가 404가 되도록 두면 안 되며 반드시 Backend로 전달해야 한다.
1.14 배포 특이사항
waggle-network와 운영 데이터 볼륨은 Compose 외부 리소스다. 먼저 생성해야 한다.
PostgreSQL과 RabbitMQ 비밀번호는 기존 볼륨의 현재 값과 같아야 한다.
Backend와 AI 배포는 기존 컨테이너를 먼저 제거하므로 짧은 중단 시간이 발생한다.
Backend 준비 상태는 Health API가 아니라 시작 로그 문자열로 판정한다.
AI API와 Worker는 같은 이미지지만 서로 다른 프로세스로 실행한다.
Backend↔AI 내부 키는 방향별로 두 개다.Backend → AI: INTERNAL_API_KEY
AI → Backend: INTERNAL_API_SECRET

두 값은 각각 Backend와 AI Jenkins Job에서 동일한 Credential을 참조해야 한다.
Frontend EXPO_PUBLIC_*는 번들에 노출되므로 비밀값으로 취급할 수 없다.
AI/requirements.txt, Temurin 이미지 태그, python:3.12-slim, rabbitmq:4-management는 일부 버전이 떠 있어 장기 재현성이 보장되지 않는다.
Nginx, TLS 인증서, assetlinks.json, Jenkins Job 설정은 저장소에 없으므로 별도 인수인계가 필요하다.