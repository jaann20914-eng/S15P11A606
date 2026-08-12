# k6 부하테스트

와글와글 백엔드의 4개 핵심 흐름(로그인, 핀 등록, 핀 조회, 채팅)에 대한 k6 부하테스트.

## 구성

```
loadtest/
├── lib/
│   ├── config.js        # 공통 설정 (BASE_URL, 예약 ID 대역 등)
│   ├── jwt.js           # JWT_SECRET으로 액세스 토큰 직접 발급
│   └── stomp.js         # STOMP 1.2 프레임 빌더/파서
├── seed/
│   ├── seed.sql         # 테스트 회원/장소/핀/채팅방 시드 (재실행 가능)
│   ├── refresh-pins.sql # 시드 핀 유효시간 갱신 (1시간 경과 시)
│   └── mint-refresh-tokens.js  # 로그인 테스트용 리프레시 토큰 발급 (Node)
└── scenarios/
    ├── login.js         # POST /auth/refresh (토큰 발급 경로)
    ├── pin-read.js      # 지도 조회 → 장소 홈 → 핀 상세
    ├── pin-create.js    # upload-url 발급 (+옵션: S3 업로드 → 핀 등록 전체 흐름)
    ├── chat.js          # STOMP WebSocket 채팅 송수신 + RTT 측정
    └── mixed.js         # 조회+등록+채팅 혼합
```

## 설계상 우회 지점 (왜 이렇게 만들었나)

| 흐름 | 문제 | 우회 |
|------|------|------|
| 로그인 | 카카오/네이버 OAuth 일회용 인가코드 필요 → k6 재현 불가 | 비용 구조가 거의 같은 `POST /auth/refresh`(JWT 서명 + DB 회전)를 대상으로. 리프레시 토큰을 직접 발급해 DB에 해시를 시드 |
| 인증 | 모든 API가 Bearer 토큰 필요 | 서버와 동일한 `JWT_SECRET`으로 k6가 액세스 토큰을 직접 서명 |
| 핀 등록 | S3 객체 실존 검증 + videoKey 재사용 금지 + 장소 50m 검증 | 기본은 upload-url만. 전체 흐름은 `FULL_PIN_CREATE=1`로 더미 mp4를 S3에 실제 업로드 |
| 핀 조회 | 장소당 카카오 API 실시간 호출 (30초 캐시) | 고정 bbox 1개 사용 → 카카오 호출 30초당 1회로 억제 |
| 채팅 | 채팅방 개설에 핀 잠금해제(크레딧) 퍼널 필요 | ACTIVE 상태 채팅방을 DB에 직접 시드 |

## 사전 준비

**반드시 부하테스트 전용 환경(별도 DB)에서 실행할 것.** 시드가 예약 ID 대역(members 910001~930000, places 990001)을 정리 후 재생성한다.

```bash
# 1. k6 설치
winget install k6 --source winget

# 2. 데이터 시드 (n = 테스트 계정 쌍 수, 스크립트의 MEMBERS와 맞출 것)
psql "$DATABASE_URL" -v n=100 -f seed/seed.sql

# 3. (로그인 테스트만) 리프레시 토큰 발급 + DB 적용 — 매 실행 전 반복 필요
JWT_SECRET=<서버와 동일> MEMBERS=100 node seed/mint-refresh-tokens.js
psql "$DATABASE_URL" -f seed/refresh-tokens.sql
```

## 실행

공통 환경변수: `BASE_URL`(기본 http://localhost:8080), `JWT_SECRET`(필수, 서버와 동일), `MEMBERS`(기본 100, 시드 개수와 일치), `VUS`, `DURATION`

```bash
# 핀 조회 (기본 50 VU / 2분)
k6 run -e BASE_URL=http://localhost:8080 -e JWT_SECRET=... scenarios/pin-read.js
```

```bash
# 핀 등록 — upload-url만
k6 run -e BASE_URL=http://localhost:8080 -e JWT_SECRET=... scenarios/pin-create.js
```

```bash
# 핀 등록 — S3 업로드 + 등록 전체 흐름 (RabbitMQ/AI 워커까지 부하 전파됨)
k6 run -e BASE_URL=http://localhost:8080 -e JWT_SECRET=... -e FULL_PIN_CREATE=1 scenarios/pin-create.js
```

```bash
# 채팅 (WS, 세션당 10개 메시지)
k6 run -e BASE_URL=http://localhost:8080 -e JWT_SECRET=... scenarios/chat.js
```

```bash
# 로그인 (VUS <= MEMBERS 필수, 매 실행 전 토큰 재시드)
k6 run -e BASE_URL=http://localhost:8080 -e VUS=20 scenarios/login.js
```

```bash
# 혼합 (조회 50 + 등록 10 + 채팅 20 VU)
k6 run -e BASE_URL=http://localhost:8080 -e JWT_SECRET=... scenarios/mixed.js
```

```bash
# 결과 JSON 저장
k6 run --summary-export=result.json -e BASE_URL=... -e JWT_SECRET=... scenarios/pin-read.js
```

## 주의사항

- **시드 핀은 1시간만 유효** — 지도 조회가 "최근 1시간 내 생성" 핀만 집계한다. 1시간 지나면 `psql -f seed/refresh-pins.sql` 재실행.
- **로그인 테스트는 매 실행 전 토큰 재시드** — 서버가 RTR(리프레시 토큰 회전) 방식이라 한 번 돌리면 JSON의 토큰이 전부 무효화된다. 같은 토큰 파일로 두 번 돌리면 재사용 감지에 걸려 체인 전체가 폐기된다.
- **로그인 테스트 VUS ≤ MEMBERS** — 토큰 체인이 VU당 1개 필요.
- **핀 조회의 bbox를 임의 값으로 바꾸지 말 것** — bbox마다 캐시 키가 달라져 캐시 미스 시 장소당 카카오 API를 호출한다. 쿼터 소진 위험.
- **FULL_PIN_CREATE는 실제 S3 쓰기 + RabbitMQ 잡 생성** — 더미 파일이라 AI 블러는 실패(FAILED)로 끝난다. API 파이프라인 처리량 측정 목적으로만.
- **k6 머신과 서버는 분리** — 같은 머신이면 k6가 CPU를 점유해 결과가 왜곡된다.
- **채팅 스크립트는 k6 v0.48 이상** 필요 (`k6/experimental/websockets`).

## 결과 해석

- `http_req_duration`의 **p(95)/p(99)** 를 보라 (평균은 느린 꼬리를 숨김). 태그 `name`으로 요청별 분리: `places_bbox`, `place_home`, `pin_detail`, `pin_upload_url`, `pin_create`, `auth_refresh`, `chat_rooms_list`
- 커스텀 메트릭:
  - `chat_message_rtt` — 메시지 전송 → 브로드캐스트 수신 왕복 지연
  - `chat_message_delivered` — 메시지 전달률
  - `login_refresh_ok`, `pin_read_map_ok`, `pin_create_upload_url_ok` — 흐름별 성공률
- 서버 측 상관 분석: `/actuator/prometheus`가 열려 있고 `http.server.requests`에 퍼센타일 히스토그램이 켜져 있다(`application=waggle-backend`). 부하 중 Grafana에서 CPU/메모리/DB 커넥션/RabbitMQ 큐 길이를 함께 볼 것.
