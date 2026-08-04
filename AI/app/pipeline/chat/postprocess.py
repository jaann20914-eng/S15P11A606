from datetime import UTC, datetime

from app.pipeline.chat.infer import InferResult
from app.schemas.chat_risk import ChatAnalysisBatch, PatternResultCallback


def to_completed_callback(
    batch: ChatAnalysisBatch,
    result: InferResult,
) -> PatternResultCallback:
    return PatternResultCallback(
        requestId=batch.requestId,
        roomId=batch.roomId,
        isRisky=result.is_risky,
        reasonCode=result.reason_code,
        status="COMPLETED",
        analyzedAt=datetime.now(UTC),
    )


def to_failed_callback(batch: ChatAnalysisBatch) -> PatternResultCallback:
    # 판정을 못 낸 것과 무해 판정은 다르다. Back은 FAILED에 경고를 띄우지 않는다.
    return PatternResultCallback(
        requestId=batch.requestId,
        roomId=batch.roomId,
        isRisky=None,
        reasonCode=None,
        status="FAILED",
        analyzedAt=datetime.now(UTC),
    )
