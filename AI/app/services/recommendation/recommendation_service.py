import hashlib
from datetime import UTC, datetime

from app.common.logging import get_logger
from app.schemas.recommendation import (
    CandidatePlace,
    ScoredPlace,
    ScoreRequest,
    ScoreResponse,
)

logger = get_logger(__name__)

# 혼잡도 4단계(1 유유자적 ~ 4 와글와글)의 평균이 이 값 이상이면 "와글"로 본다.
# 화면 배지가 평균을 반올림해 단계를 정하므로 그 경계(2.5)와 맞춘다.
CROWD_LEVEL_BUSY_THRESHOLD = 2.5

_MAX_UINT32 = 0xFFFFFFFF


def _mock_score(place_id: int) -> float:
    """placeId로부터 0.0~1.0 사이의 고정된 값을 만든다. 개인화 로직은 아직 없다."""
    digest = hashlib.sha256(str(place_id).encode()).digest()
    return round(int.from_bytes(digest[:4], "big") / _MAX_UINT32, 2)


def _to_scored_place(place: CandidatePlace) -> ScoredPlace:
    return ScoredPlace(
        placeId=place.placeId,
        representativePinId=place.representativePinId,
        score=_mock_score(place.placeId),
    )


def _sort_by_score_desc(places: list[ScoredPlace]) -> list[ScoredPlace]:
    return sorted(places, key=lambda place: place.score, reverse=True)


def score_places(request: ScoreRequest) -> ScoreResponse:
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
            busyList=[],
            lastUpdated=datetime.now(UTC),
        )

    relaxed: list[ScoredPlace] = []
    busy: list[ScoredPlace] = []

    for place in request.candidatePlaces:
        target = busy if place.crowdLevel >= CROWD_LEVEL_BUSY_THRESHOLD else relaxed
        target.append(_to_scored_place(place))

    response = ScoreResponse(
        relaxedList=_sort_by_score_desc(relaxed),
        busyList=_sort_by_score_desc(busy),
        lastUpdated=datetime.now(UTC),
    )

    logger.info(
        "scoring finished | userId=%s relaxed=%d busy=%d",
        request.userId,
        len(response.relaxedList),
        len(response.busyList),
    )

    return response
