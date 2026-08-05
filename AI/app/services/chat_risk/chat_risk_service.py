import asyncio

from app.clients.gemini_client import GeminiRejectedError, GeminiUnavailableError
from app.common.logging import get_logger
from app.core.config import settings
from app.pipeline.chat.infer import infer
from app.pipeline.chat.postprocess import to_completed_callback, to_failed_callback
from app.pipeline.chat.preprocess import preprocess
from app.pipeline.chat.validate import collect_analyzable_messages
from app.schemas.chat_risk import ChatAnalysisBatch, PatternResultCallback

logger = get_logger(__name__)

RETRY_DELAY_SECONDS = 1.0


async def analyze(batch: ChatAnalysisBatch) -> PatternResultCallback:
    prepared = preprocess(collect_analyzable_messages(batch))
    max_attempts = settings.chat_analysis_max_retries + 1

    for attempt in range(1, max_attempts + 1):
        try:
            result = await infer(prepared)
        except GeminiRejectedError as error:
            logger.error(
                "chat risk analysis rejected | requestId=%s roomId=%s reason=%s",
                batch.requestId,
                batch.roomId,
                error,
            )
            return to_failed_callback(batch)
        except GeminiUnavailableError as error:
            logger.warning(
                "chat risk analysis attempt failed | "
                "requestId=%s roomId=%s attempt=%d/%d reason=%s",
                batch.requestId,
                batch.roomId,
                attempt,
                max_attempts,
                error,
            )

            if attempt < max_attempts:
                # 쿼터 초과는 분당 제한이라 곧바로 다시 보내면 같은 이유로 막힌다.
                await asyncio.sleep(RETRY_DELAY_SECONDS * attempt)

            continue

        logger.info(
            "chat risk analysis finished | "
            "requestId=%s roomId=%s isRisky=%s reasonCode=%s usedLlm=%s attempt=%d",
            batch.requestId,
            batch.roomId,
            result.is_risky,
            result.reason_code,
            result.used_llm,
            attempt,
        )

        return to_completed_callback(batch, result)

    logger.error(
        "chat risk analysis gave up | requestId=%s roomId=%s attempts=%d",
        batch.requestId,
        batch.roomId,
        max_attempts,
    )

    return to_failed_callback(batch)
