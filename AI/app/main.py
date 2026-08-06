from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from prometheus_fastapi_instrumentator import Instrumentator

from app.common.logging import get_logger
from app.core.config import settings
from app.core.security import InternalAuthError
from app.routers import recommendations
from app.schemas.recommendation import ErrorResponse
from app.services.recommendation.recommendation_service import ScoringTimeoutError

logger = get_logger(__name__)

app = FastAPI(title="와글와글 AI 서버")

# 수집용 /metrics와 배포 확인용 /health는 실제 트래픽이 아니라 요청 통계에서 뺀다.
# 상태코드를 2xx/4xx/5xx로 묶으면 타임아웃(504)과 내부 오류(500)가 섞이므로 그대로 남긴다.
Instrumentator(
    excluded_handlers=["/metrics", "/health"],
    should_group_status_codes=False,
).instrument(app).expose(app)

app.include_router(recommendations.router)


def _error_response(status_code: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content=ErrorResponse(
            statusCode=status_code,
            code=code,
            message=message,
        ).model_dump(),
    )


def _first_validation_message(error: RequestValidationError) -> str:
    errors = error.errors()

    if not errors:
        return "invalid request payload"

    first = errors[0]
    location = ".".join(str(part) for part in first["loc"] if part != "body")

    return f"{location}: {first['msg']}"


@app.exception_handler(RequestValidationError)
async def handle_validation_error(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    return _error_response(
        400,
        "INVALID_REQUEST_PAYLOAD",
        _first_validation_message(exc),
    )


@app.exception_handler(InternalAuthError)
async def handle_internal_auth_error(
    request: Request,
    exc: InternalAuthError,
) -> JSONResponse:
    return _error_response(
        401,
        "UNAUTHORIZED",
        "invalid x-internal-api-key",
    )


@app.exception_handler(ScoringTimeoutError)
async def handle_scoring_timeout_error(
    request: Request,
    exc: ScoringTimeoutError,
) -> JSONResponse:
    return _error_response(
        504,
        "SCORING_TIMEOUT",
        f"scoring request exceeded {settings.scoring_timeout_ms}ms",
    )


# 앱 최상단 안전망. 잡지 않으면 traceback이 응답에 실려 내부 경로가 노출된다.
# 원인은 로그에만 남기고 응답에는 정해진 문구만 내보낸다.
@app.exception_handler(Exception)
async def handle_unexpected_error(
    request: Request,
    exc: Exception,
) -> JSONResponse:
    logger.exception("unhandled error | path=%s", request.url.path)

    return _error_response(
        500,
        "SCORING_FAILED",
        "internal scoring error",
    )


@app.get("/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}
