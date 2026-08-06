from datetime import UTC, datetime

from prometheus_client import Histogram, start_http_server

from app.core.config import settings

# 기본 버킷은 최대 10초까지만 나눠서 분 단위인 블러 처리 시간이 한 칸에 뭉개진다.
_BLUR_BUCKETS = (1, 2, 5, 10, 20, 30, 60, 120, 300)
_CHAT_BUCKETS = (0.5, 1, 2, 5, 10, 20, 30, 60)
_GEMINI_BUCKETS = (0.25, 0.5, 1, 2, 3, 5, 10)

# 요청 발행부터 결과 발행까지. 큐에서 기다린 시간이 포함된 체감 지연이다.
blur_e2e_seconds = Histogram(
    "ai_blur_e2e_seconds",
    "블러 요청 발행부터 결과 발행까지 걸린 시간",
    ["result"],
    buckets=_BLUR_BUCKETS,
)

# 처리 구간만. e2e에서 빼면 큐 대기 시간이 나온다.
blur_duration_seconds = Histogram(
    "ai_blur_duration_seconds",
    "블러 파이프라인 처리 시간",
    buckets=_BLUR_BUCKETS,
)

chat_e2e_seconds = Histogram(
    "ai_chat_e2e_seconds",
    "채팅 배치 발행부터 콜백 전송까지 걸린 시간",
    ["result"],
    buckets=_CHAT_BUCKETS,
)

gemini_duration_seconds = Histogram(
    "ai_gemini_duration_seconds",
    "Gemini 판정 호출에 걸린 시간",
    ["result"],
    buckets=_GEMINI_BUCKETS,
)


def elapsed_since(started_at: datetime) -> float:
    return (datetime.now(UTC) - started_at).total_seconds()


def start_metrics_server() -> None:
    start_http_server(settings.metrics_port)
