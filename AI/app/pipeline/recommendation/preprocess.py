from dataclasses import dataclass
from datetime import datetime
from math import asin, cos, exp, radians, sin, sqrt

from app.schemas.recommendation import (
    AgeGroup,
    CandidatePlace,
    CategoryCode,
    Gender,
    ScoreRequest,
)

EARTH_RADIUS_METERS = 6371000.0

# 거리 점수가 1/e로 떨어지는 지점. 반경 안에서 가까운 쪽을 확실히 앞세우려고 짧게 잡는다.
DISTANCE_DECAY_METERS = 500.0

# 언락 수가 이 값일 때 인기 점수가 0.5가 된다.
# 소수의 인기 장소가 독식하지 않도록 완만하게 포화시킨다.
POPULARITY_SATURATION = 20.0

# 신선도 점수가 1/e로 떨어지는 지점. 핀 수명이 1시간이라 그 안에서 갈리도록 짧게 잡는다.
FRESHNESS_DECAY_MINUTES = 30.0

# 작성자 수가 이 값일 때 인구통계 원점수의 절반만 반영한다.
# 표본이 적을수록 중립(0.5)으로 끌어당긴다.
DEMOGRAPHIC_SHRINKAGE = 10.0

DEMOGRAPHIC_NEUTRAL = 0.5


@dataclass(frozen=True)
class PlaceFeatures:
    proximity: float
    category: float
    popularity: float
    freshness: float
    demographic: float


def haversine_meters(
    latitude1: float,
    longitude1: float,
    latitude2: float,
    longitude2: float,
) -> float:
    latitude1_radians = radians(latitude1)
    latitude2_radians = radians(latitude2)
    latitude_delta = radians(latitude2 - latitude1)
    longitude_delta = radians(longitude2 - longitude1)

    haversine = (
        sin(latitude_delta / 2) ** 2
        + cos(latitude1_radians) * cos(latitude2_radians) * sin(longitude_delta / 2) ** 2
    )

    return 2 * EARTH_RADIUS_METERS * asin(sqrt(haversine))


def proximity_score(distance_meters: float) -> float:
    return exp(-distance_meters / DISTANCE_DECAY_METERS)


def category_score(
    preferred_categories: list[CategoryCode],
    category: CategoryCode,
) -> float:
    # 온보딩이 선호 카테고리의 순위를 저장하지 않아 배열 순서에는 의미가 없다.
    return 1.0 if category in preferred_categories else 0.0


def popularity_score(unlock_count_7d: int) -> float:
    return unlock_count_7d / (unlock_count_7d + POPULARITY_SATURATION)


def freshness_score(last_pin_activated_at: datetime, now: datetime) -> float:
    elapsed_minutes = (now - last_pin_activated_at).total_seconds() / 60

    # 서버 간 시계 오차로 활성화 시각이 미래면 지수가 양수가 되어 점수가 1을 넘는다.
    return exp(-max(0.0, elapsed_minutes) / FRESHNESS_DECAY_MINUTES)


def demographic_score(
    gender: Gender,
    age_group: AgeGroup,
    author_gender_dist: dict[Gender, float],
    author_age_dist: dict[AgeGroup, float],
    author_count: int,
) -> float:
    # 비율이 0인 항목은 분포에서 생략될 수 있다.
    raw_score = 0.5 * author_gender_dist.get(gender, 0.0) + 0.5 * author_age_dist.get(
        age_group,
        0.0,
    )

    confidence = author_count / (author_count + DEMOGRAPHIC_SHRINKAGE)

    return DEMOGRAPHIC_NEUTRAL + (raw_score - DEMOGRAPHIC_NEUTRAL) * confidence


def to_place_features(request: ScoreRequest, place: CandidatePlace) -> PlaceFeatures:
    distance_meters = haversine_meters(
        request.latitude,
        request.longitude,
        place.latitude,
        place.longitude,
    )

    return PlaceFeatures(
        proximity=proximity_score(distance_meters),
        category=category_score(request.preferredCategories, place.category),
        popularity=popularity_score(place.unlockCount7d),
        # 서버 시계가 아니라 요청 시각을 기준으로 삼아야 같은 요청이 같은 점수를 낸다.
        freshness=freshness_score(place.lastPinActivatedAt, request.requestedAt),
        demographic=demographic_score(
            request.gender,
            request.ageGroup,
            place.authorGenderDist,
            place.authorAgeDist,
            place.authorCount,
        ),
    )
