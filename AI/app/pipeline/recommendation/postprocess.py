from app.schemas.recommendation import CandidatePlace, ScoredPlace

# 혼잡도 4단계(1 유유자적 ~ 4 와글와글)의 평균이 이 값 이상이면 "와글"로 본다.
# 화면 배지가 평균을 반올림해 단계를 정하므로 그 경계(2.5)와 맞춘다.
CROWD_LEVEL_WAGLE_THRESHOLD = 2.5

# 화면이 섹션당 10개를 보여준다. 요청에 limit 필드가 없어 여기서 자른다.
SECTION_LIMIT = 10


def _to_scored_place(place: CandidatePlace, score: float) -> ScoredPlace:
    return ScoredPlace(
        placeId=place.placeId,
        representativePinId=place.representativePinId,
        score=score,
    )


def _sort_and_limit(places: list[ScoredPlace]) -> list[ScoredPlace]:
    # 안정 정렬이라 점수가 같으면 후보로 받은 순서를 유지한다.
    ranked = sorted(places, key=lambda place: place.score, reverse=True)

    return ranked[:SECTION_LIMIT]


def split_into_sections(
    scored_places: list[tuple[CandidatePlace, float]],
) -> tuple[list[ScoredPlace], list[ScoredPlace]]:
    relaxed: list[ScoredPlace] = []
    wagle: list[ScoredPlace] = []

    for place, score in scored_places:
        target = wagle if place.crowdLevel >= CROWD_LEVEL_WAGLE_THRESHOLD else relaxed
        target.append(_to_scored_place(place, score))

    return _sort_and_limit(relaxed), _sort_and_limit(wagle)
