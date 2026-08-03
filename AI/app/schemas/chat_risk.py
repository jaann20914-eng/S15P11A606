from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)

ReasonCode = Literal[
    "EXTERNAL_MESSENGER_INDUCEMENT",
    "FRAUD_SCAM",
    "ILLEGAL_GOODS_TRADE",
    "ETC_SUSPICIOUS",
]

AnalysisStatus = Literal[
    "COMPLETED",
    "FAILED",
]


class PatternResultCallback(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # Back이 중복 수신을 걸러내는 멱등성 키라 재시도해도 같은 값을 보낸다.
    requestId: UUID

    roomId: int = Field(ge=1)

    isRisky: bool | None

    reasonCode: ReasonCode | None = None

    status: AnalysisStatus

    analyzedAt: datetime

    @field_validator("analyzedAt")
    @classmethod
    def analyzed_at_must_have_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("analyzedAt must include a timezone.")
        return value

    @model_validator(mode="after")
    def status_must_match_result_fields(self) -> "PatternResultCallback":
        if self.status == "FAILED":
            if self.isRisky is not None or self.reasonCode is not None:
                raise ValueError("FAILED result must leave isRisky and reasonCode null.")
            return self

        if self.isRisky is None:
            raise ValueError("COMPLETED result must include isRisky.")

        if not self.isRisky and self.reasonCode is not None:
            raise ValueError("reasonCode is allowed only when isRisky is true.")

        return self
