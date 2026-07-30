from datetime import datetime
from typing import Literal

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


def require_timezone(value: datetime, field_name: str) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{field_name} must include a timezone.")
    return value


class CandidatePlace(BaseModel):
    model_config = ConfigDict(extra="forbid")

    placeId: str = Field(min_length=1)

    representativePinId: str = Field(min_length=1)

    latitude: float = Field(ge=-90, le=90)

    longitude: float = Field(ge=-180, le=180)

    category: CategoryCode

    # 혼잡도 4단계(1 유유자적 ~ 4 와글와글)의 평균값이라 소수점이 올 수 있다.
    crowdLevel: float = Field(ge=1, le=4)

    latestPinCreatedAt: datetime

    avgAuthorTrust: float

    @field_validator("latestPinCreatedAt")
    @classmethod
    def latest_pin_created_at_must_have_timezone(
        cls,
        value: datetime,
    ) -> datetime:
        return require_timezone(value, "latestPinCreatedAt")


class ScoreRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    userId: str = Field(min_length=1)

    latitude: float = Field(ge=-90, le=90)

    longitude: float = Field(ge=-180, le=180)

    preferredCategories: list[CategoryCode] = Field(
        min_length=1,
        max_length=3,
    )

    gender: Gender | None = None

    ageGroup: AgeGroup | None = None

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

    placeId: str

    representativePinId: str

    score: float


class ScoreResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    relaxedList: list[ScoredPlace]

    busyList: list[ScoredPlace]

    lastUpdated: datetime


class ErrorResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    statusCode: int

    code: str

    message: str
