import asyncio
from datetime import UTC, datetime

from app.common.logging import get_logger
from app.core.config import settings
from app.pipeline.recommendation.infer import compute_score
from app.pipeline.recommendation.postprocess import split_into_sections
from app.pipeline.recommendation.preprocess import to_place_features
from app.schemas.recommendation import (
    ScoredPlace,
    ScoreRequest,
    ScoreResponse,
)

logger = get_logger(__name__)


class ScoringTimeoutError(Exception):
    pass


def _score_candidates(
    request: ScoreRequest,
) -> tuple[list[ScoredPlace], list[ScoredPlace]]:
    scored_places = [
        (place, compute_score(to_place_features(request, place)))
        for place in request.candidatePlaces
    ]

    return split_into_sections(scored_places)


async def score_places(request: ScoreRequest) -> ScoreResponse:
    logger.info(
        "scoring started | userId=%s requestedAt=%s candidates=%d",
        request.userId,
        request.requestedAt.isoformat(),
        len(request.candidatePlaces),
    )

    # 후보 0건은 에러가 아니라 정상 분기다.
    if not request.candidatePlaces:
        logger.info("scoring skipped | userId=%s reason=no candidates", request.userId)
        return ScoreResponse(
            relaxedList=[],
            wagleList=[],
            lastUpdated=datetime.now(UTC),
        )

    try:
        # 계산은 CPU 바운드라 별도 스레드로 보낸다.
        # 이벤트 루프를 붙잡으면 제한 시간이 감시되지 않는다.
        relaxed, wagle = await asyncio.wait_for(
            asyncio.to_thread(_score_candidates, request),
            timeout=settings.scoring_timeout_ms / 1000,
        )
    except TimeoutError as error:
        logger.error(
            "scoring timed out | userId=%s candidates=%d limitMs=%d",
            request.userId,
            len(request.candidatePlaces),
            settings.scoring_timeout_ms,
        )
        raise ScoringTimeoutError from error

    response = ScoreResponse(
        relaxedList=relaxed,
        wagleList=wagle,
        lastUpdated=datetime.now(UTC),
    )

    logger.info(
        "scoring finished | userId=%s relaxed=%d wagle=%d",
        request.userId,
        len(response.relaxedList),
        len(response.wagleList),
    )

    return response
