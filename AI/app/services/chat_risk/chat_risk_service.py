from datetime import UTC, datetime

from app.common.logging import get_logger
from app.schemas.chat_risk import ChatAnalysisBatch, PatternResultCallback

logger = get_logger(__name__)


async def analyze(batch: ChatAnalysisBatch) -> PatternResultCallback:
    """패턴 분석 자리를 잡아두는 스텁. 항상 위험 없음으로 판정한다.

    실제 판정 로직이 들어오면 이 함수 내부만 교체하면 되도록
    입출력 모양을 먼저 고정한다.
    """
    logger.info(
        "chat risk analysis skipped | requestId=%s roomId=%s messages=%d",
        batch.requestId,
        batch.roomId,
        len(batch.chatMessages),
    )

    return PatternResultCallback(
        requestId=batch.requestId,
        roomId=batch.roomId,
        isRisky=False,
        status="COMPLETED",
        analyzedAt=datetime.now(UTC),
    )
