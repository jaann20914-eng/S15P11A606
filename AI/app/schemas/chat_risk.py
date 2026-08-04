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

MAX_CONTENT_LENGTH = 500


def _require_timezone(value: datetime, field_name: str) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{field_name} must include a timezone.")
    return value


class ChatMessageItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    senderId: int = Field(ge=1)

    content: str = Field(min_length=1, max_length=MAX_CONTENT_LENGTH)


class ChatAnalysisBatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # Back의 AiChatJob PK. 콜백에 그대로 실어 어느 배치의 결과인지 알린다.
    requestId: UUID

    roomId: int = Field(ge=1)

    sentAt: datetime

    # 분석할 내용이 없는 배치는 발행 측 버그라 받아주지 않는다.
    chatMessages: list[ChatMessageItem] = Field(min_length=1)

    @field_validator("sentAt")
    @classmethod
    def sent_at_must_have_timezone(cls, value: datetime) -> datetime:
        return _require_timezone(value, "sentAt")


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
        return _require_timezone(value, "analyzedAt")

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
