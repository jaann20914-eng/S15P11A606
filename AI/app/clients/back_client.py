import httpx

from app.common.logging import get_logger
from app.core.config import settings
from app.schemas.chat_risk import PatternResultCallback

logger = get_logger(__name__)

PATTERN_RESULT_PATH = "/api/v1/internal/chat/pattern-result"

# 페이로드·인증 키·채팅방 문제라 같은 요청을 다시 보내도 결과가 같다.
NON_RETRYABLE_STATUS_CODES = frozenset({400, 401, 404})

UNKNOWN_ERROR_CODE = "UNKNOWN"


def _error_code(response: httpx.Response) -> str:
    try:
        body = response.json()
    except ValueError:
        # 프록시가 끼어들면 JSON이 아닌 본문이 올 수 있다.
        return UNKNOWN_ERROR_CODE

    if isinstance(body, dict) and isinstance(body.get("error"), dict):
        return str(body["error"].get("code", UNKNOWN_ERROR_CODE))

    return UNKNOWN_ERROR_CODE


class BackClient:
    def __init__(self, transport: httpx.AsyncBaseTransport | None = None) -> None:
        self._transport = transport
        self._client: httpx.AsyncClient | None = None

    def _require_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(
                base_url=settings.back_base_url,
                timeout=settings.chat_callback_timeout_seconds,
                headers={"X-Internal-Secret": settings.internal_api_secret},
                transport=self._transport,
            )

        return self._client

    async def close(self) -> None:
        if self._client is None:
            return

        await self._client.aclose()
        self._client = None

    async def send_pattern_result(self, result: PatternResultCallback) -> bool:
        payload = result.model_dump(mode="json")
        max_attempts = settings.chat_callback_max_retries + 1

        for attempt in range(1, max_attempts + 1):
            try:
                response = await self._require_client().post(
                    PATTERN_RESULT_PATH,
                    json=payload,
                )
            except httpx.HTTPError as error:
                logger.warning(
                    "chat pattern callback attempt failed | "
                    "roomId=%s requestId=%s attempt=%d/%d reason=%s",
                    result.roomId,
                    result.requestId,
                    attempt,
                    max_attempts,
                    type(error).__name__,
                )
                continue

            if response.status_code == httpx.codes.OK:
                logger.info(
                    "chat pattern callback sent | roomId=%s requestId=%s attempt=%d",
                    result.roomId,
                    result.requestId,
                    attempt,
                )
                return True

            if response.status_code in NON_RETRYABLE_STATUS_CODES:
                logger.error(
                    "chat pattern callback rejected | roomId=%s requestId=%s status=%d code=%s",
                    result.roomId,
                    result.requestId,
                    response.status_code,
                    _error_code(response),
                )
                return False

            logger.warning(
                "chat pattern callback attempt failed | "
                "roomId=%s requestId=%s attempt=%d/%d status=%d code=%s",
                result.roomId,
                result.requestId,
                attempt,
                max_attempts,
                response.status_code,
                _error_code(response),
            )

        logger.error(
            "chat pattern callback gave up | roomId=%s requestId=%s attempts=%d",
            result.roomId,
            result.requestId,
            max_attempts,
        )

        return False


back_client = BackClient()
