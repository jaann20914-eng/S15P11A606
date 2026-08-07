# 🐝 와글와글 AI 서버

이 폴더는 실시간 장소 공유 플랫폼 **와글와글**의 **AI 서버 코드**입니다. 서비스 전반은 루트 README를 참고하세요.

자체 DB를 두지 않습니다. 판단에 필요한 데이터는 Back이 실어 보내고, 결과만 돌려줍니다.

```
Back 서버 ──┬── RabbitMQ ───> AI 워커    1️⃣ 블러   2️⃣ 채팅 분석   ──> 결과 발행 · 콜백
            └── 동기 REST ──> AI 서버    3️⃣ 추천 점수            ──> 즉시 응답
```

통신 방식이 갈리는 기준은 **응답을 기다릴 수 있느냐**입니다. 추천은 화면에 바로 뿌려야 해서 동기로,
블러·채팅은 오래 걸리거나 기다릴 필요가 없어 큐로 처리합니다.

둘 다 내부 통신이라 외부에 열려 있지 않습니다. 수신은 `x-internal-api-key`, 발신은 `X-Internal-Secret`.

---

## 🧩 세 가지 기능

### 1️⃣ 영상 얼굴 블러 처리

현장 영상에 찍힌 행인 얼굴을 게시 전에 자동으로 가립니다 (초상권).

```
ai.blur.request → S3 다운로드 → 얼굴 검출·추적 → 블러 → 검증 → 썸네일·영상 업로드 → ai.blur.result
```

- **추적** — 검출이 끊긴 프레임을 이어 붙여 얼굴이 새지 않게 합니다.
- **검증** — 충분히 가려졌는지 확인하고, 실패하면 업로드하지 않고 사유만 돌려줍니다.

### 2️⃣ 채팅 범죄 의심 패턴 감지

익명 채팅방의 사기·불법 거래·외부 메신저 유도를 찾아 경고를 띄우도록 알립니다 (제재는 하지 않음).
Back이 **5초 단위로 방마다 묶어** 보낸 배치 하나를 통째로 읽고 한 번 판정합니다.

```
ai.chat.message → 전처리 → 룰 프리필터 → (신호가 있을 때만) Gemini 문맥 판정 → Back 콜백
```

- **2단계인 이유** — 모든 대화를 LLM에 보내면 비용이 감당되지 않습니다. 대부분은 프리필터에서 끝납니다.
- **룰은 무해 판정만** — 단어만 보고 위험이라 하면 멀쩡한 대화가 경고를 받습니다. 위험 판정은 Gemini가.

### 3️⃣ 장소 추천 점수 계산

후보 장소에 점수를 매겨 **"여유 / 와글"** 두 묶음으로 나눠 돌려줍니다. 후보는 Back이 조회해 보냅니다.

```
POST /api/v1/internal/recommendations/score
  → 전처리(거리 · 카테고리 · 신선도) → 점수 계산 → 섹션 분류 → 응답
```

- CPU 작업이라 별도 스레드에서 돌리고, 2초를 넘기면 `504 SCORING_TIMEOUT`으로 끊습니다.

---

## 🏗️ 프로젝트 구조

요청이 거치는 순서대로 계층을 나눴습니다. 라우터는 검증만 하고, 외부 HTTP 호출은 `clients/`에만 둡니다.

```
app/
  main.py       FastAPI 앱 — 추천 API, /health, /metrics
  routers/      요청 검증과 응답 반환만
  workers/      RabbitMQ 컨슈머 — 블러, 채팅
  services/     기능 단위 오케스트레이션
  pipeline/     전처리 → 추론 → 후처리
  clients/      외부 호출 — Back 콜백, Gemini
  messaging/    큐·익스체인지 선언과 발행
  schemas/      Pydantic 요청·응답 모델
  common/       로깅, 예외, 지표
  core/         설정, 인증
worker.py       워커 프로세스 진입점
tests/          app/ 구조를 그대로 미러링
```

**스택** — Python 3.12 · FastAPI · Pydantic v2 / aio-pika / httpx / google-genai /
insightface · onnxruntime · opencv / boto3

---

## 🚀 로컬 실행

```bash
python -m venv .venv                                      # 가상환경 안에서만 작업합니다
pip install -r requirements.txt -r requirements-dev.txt
cp .env.example .env

uvicorn app.main:app --reload    # 추천 API
python worker.py                 # 블러·채팅 워커 (RabbitMQ 필요)
```

## ✅ 검증

커밋 전에 이 순서로 돌립니다. 배포 파이프라인도 같은 순서로 검사하고, 실패하면 이미지를 만들지 않습니다.

```bash
mypy app/ && pytest && ruff check .
```

---

## 📦 배포

이미지 하나로 **컨테이너 두 개**를 띄웁니다. 블러가 CPU를 오래 붙잡아 API 응답을 밀기 때문에 프로세스를 나눴습니다.

| 컨테이너 | 실행 명령 | 포트 |
|---|---|---|
| `waggle-ai` | `uvicorn app.main:app` | 8000 (호스트 `127.0.0.1:8991`) |
| `waggle-ai-worker` | `python worker.py` | 9000 (지표 전용, 네트워크 내부만) |

AI 전용 Jenkins Job(`Jenkinsfile`)이 검증 → 빌드 → 교체하고, 기동에 실패하면 이전 이미지로 되돌립니다.

**주요 환경 변수** — `INTERNAL_API_KEY`, `INTERNAL_API_SECRET`, `RABBITMQ_URL`, `BACK_BASE_URL`,
`GEMINI_API_KEY`, `AWS_*`, `METRICS_PORT`(기본 9000)

---

## 📊 모니터링

Prometheus로 수집해 Grafana `와글와글 Overview` 대시보드의 `🤖 AI 서버` 영역에서 봅니다.

처리 시간이 아니라 **요청 발행부터 결과가 나갈 때까지 전 구간**을 잽니다. 처리 시간만 재면 큐에서
기다린 시간이 빠져 "서버는 빠른데 사용자는 느린" 상황을 놓칩니다.

| 지표 | 재는 구간 |
|---|---|
| `ai_blur_e2e_seconds{result}` | 블러 요청 발행 → 결과 발행 (큐 대기 포함) |
| `ai_blur_duration_seconds` | 블러 처리 구간만 — e2e와의 차이가 곧 큐 대기 시간 |
| `ai_chat_e2e_seconds{result}` | 채팅 배치 발행 → 콜백 전송 |
| `ai_gemini_duration_seconds{result}` | Gemini 판정 호출 |

추천 API는 요청 수·지연·상태코드가 `/metrics`로 자동 계측됩니다.
