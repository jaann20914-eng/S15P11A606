from datetime import datetime
from typing import Literal, TypeVar
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)

CategoryCode = Literal[
    "CAFE",
    "RESTAURANT",
    "SHOPPING_MALL",
    "CULTURE_EXHIBITION",
    "TOURIST_ATTRACTION",
    "PARK",
]

Gender = Literal[
    "MALE",
    "FEMALE",
]

AgeGroup = Literal[
    "TEENS",
    "TWENTIES",
    "THIRTIES",
    "FORTIES",
    "FIFTIES",
    "SIXTIES",
    "SEVENTIES_AND_OVER",
]

# 비율은 Back이 나눗셈으로 만든 값이라 합이 정확히 1.0으로 떨어지지 않는다.
DISTRIBUTION_SUM_TOLERANCE = 0.01

# dict의 키 타입은 불변이라 dict[str, float]로 받으면 dict[Gender, float]를 거부한다.
DistributionKey = TypeVar("DistributionKey", bound=str)


def require_timezone(value: datetime, field_name: str) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{field_name} must include a timezone.")
    return value


def require_distribution(
    value: dict[DistributionKey, float],
    field_name: str,
) -> dict[DistributionKey, float]:
    for key, ratio in value.items():
        if not 0 <= ratio <= 1:
            raise ValueError(f"{field_name}.{key} must be between 0 and 1.")

    total = sum(value.values())

    if abs(total - 1) > DISTRIBUTION_SUM_TOLERANCE:
        raise ValueError(f"{field_name} ratios must sum to 1, got {total}.")

    return value


class CandidatePlace(BaseModel):
    model_config = ConfigDict(extra="forbid")

    placeId: int = Field(ge=1)

    representativePinId: UUID

    latitude: float = Field(ge=-90, le=90)

    longitude: float = Field(ge=-180, le=180)

    category: CategoryCode

    # 혼잡도 4단계(1 유유자적 ~ 4 와글와글)의 평균값이라 소수점이 올 수 있다.
    crowdLevel: float = Field(ge=1, le=4)

    lastPinActivatedAt: datetime

    unlockCount7d: int = Field(ge=0)

    authorCount: int = Field(ge=1)

    authorGenderDist: dict[Gender, float]

    # 비율이 0인 연령대는 생략될 수 있어 7종이 모두 오지는 않는다.
    authorAgeDist: dict[AgeGroup, float]

    @field_validator("lastPinActivatedAt")
    @classmethod
    def last_pin_activated_at_must_have_timezone(
        cls,
        value: datetime,
    ) -> datetime:
        return require_timezone(value, "lastPinActivatedAt")

    @field_validator("authorGenderDist")
    @classmethod
    def author_gender_dist_must_be_distribution(
        cls,
        value: dict[Gender, float],
    ) -> dict[Gender, float]:
        return require_distribution(value, "authorGenderDist")

    @field_validator("authorAgeDist")
    @classmethod
    def author_age_dist_must_be_distribution(
        cls,
        value: dict[AgeGroup, float],
    ) -> dict[AgeGroup, float]:
        return require_distribution(value, "authorAgeDist")


class ScoreRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    userId: int = Field(ge=1)

    latitude: float = Field(ge=-90, le=90)

    longitude: float = Field(ge=-180, le=180)

    preferredCategories: list[CategoryCode] = Field(
        min_length=1,
        max_length=3,
    )

    gender: Gender

    ageGroup: AgeGroup

    requestedAt: datetime

    candidatePlaces: list[CandidatePlace]

    @field_validator("requestedAt")
    @classmethod
    def requested_at_must_have_timezone(
        cls,
        value: datetime,
    ) -> datetime:
        return require_timezone(value, "requestedAt")


class ScoredPlace(BaseModel):
    model_config = ConfigDict(extra="forbid")

    placeId: int

    representativePinId: UUID

    score: float


class ScoreResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    relaxedList: list[ScoredPlace]

    wagleList: list[ScoredPlace]

    lastUpdated: datetime


class ErrorResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    statusCode: int

    code: str

    message: str
