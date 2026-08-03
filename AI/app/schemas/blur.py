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


class BlurRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    requestId: UUID

    pinId: UUID

    originalVideoKey: str = Field(min_length=1)

    requestedAt: datetime

    @field_validator("requestedAt")
    @classmethod
    def requested_at_must_have_timezone(
        cls,
        value: datetime,
    ) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("requestedAt must include a timezone.")
        return value


class BlurResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    requestId: UUID

    pinId: UUID

    processingStatus: Literal[
        "COMPLETED",
        "FAILED",
    ]

    finalStatus: Literal[
        "PASS",
        "FAIL",
    ] | None

    blurredVideoKey: str | None = None

    thumbnailKey: str | None = None

    code: str | None = None

    errorCode: str | None = None

    reasonCodes: list[str] = Field(
        default_factory=list
    )

    detectedFaceCount: int | None = Field(default=None, ge=0)

    validatedFaceCount: int | None = Field(default=None, ge=0)

    passCount: int | None = Field(default=None, ge=0)

    failCount: int | None = Field(default=None, ge=0)

    processingTimeSeconds: float | None = Field(default=None, ge=0)

    completedAt: datetime

    @field_validator("completedAt")
    @classmethod
    def completed_at_must_have_timezone(
        cls,
        value: datetime,
    ) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("completedAt must include a timezone.")
        return value

    @model_validator(mode="after")
    def validate_status_contract(self) -> "BlurResult":
        if self.processingStatus == "FAILED":
            if self.finalStatus is not None:
                raise ValueError("FAILED result cannot have finalStatus.")
            if not self.errorCode:
                raise ValueError("FAILED result requires errorCode.")
            if self.blurredVideoKey is not None:
                raise ValueError(
                    "FAILED result cannot have blurredVideoKey."
                )
            if self.thumbnailKey is not None:
                raise ValueError(
                    "FAILED result cannot have thumbnailKey."
                )
            return self

        if self.finalStatus == "PASS":
            if not self.blurredVideoKey:
                raise ValueError("PASS requires blurredVideoKey.")
            if not self.thumbnailKey:
                raise ValueError("PASS requires thumbnailKey.")
            return self

        if self.finalStatus == "FAIL":
            if self.blurredVideoKey is not None:
                raise ValueError("FAIL cannot have blurredVideoKey.")
            if self.thumbnailKey is not None:
                raise ValueError("FAIL cannot have thumbnailKey.")
            if not self.code:
                raise ValueError("FAIL requires code.")
            return self

        raise ValueError("COMPLETED result requires PASS or FAIL.")

    def to_message_payload(self) -> dict[str, object]:
        payload = self.model_dump(
            mode="json",
            exclude_none=True,
        )

        if self.processingStatus == "FAILED":
            payload.pop("reasonCodes", None)
            payload["finalStatus"] = None
            payload["blurredVideoKey"] = None
            payload["thumbnailKey"] = None
        elif self.finalStatus == "FAIL":
            payload["blurredVideoKey"] = None
            payload["thumbnailKey"] = None

        return payload
