import asyncio
from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch
from uuid import UUID

from app.clients.gemini_client import (
    GeminiRejectedError,
    GeminiUnavailableError,
    GeminiVerdict,
    gemini_client,
)
from app.schemas.chat_risk import (
    ChatAnalysisBatch,
    ChatMessageItem,
    PatternResultCallback,
)
from app.services.chat_risk import chat_risk_service

REQUEST_ID = UUID("44444444-4444-4444-4444-444444444444")
ROOM_ID = 7
SENT_AT = datetime(2026, 8, 4, 4, 12, 34, tzinfo=UTC)

RISKY_CONTENT = "카톡 아이디 알려주세요 거기서 얘기해요"
HARMLESS_CONTENT = "점심 뭐 먹을까요"


def build_batch(*contents: str) -> ChatAnalysisBatch:
    return ChatAnalysisBatch(
        requestId=REQUEST_ID,
        roomId=ROOM_ID,
        sentAt=SENT_AT,
        chatMessages=[ChatMessageItem(senderId=2, content=content) for content in contents],
    )


def analyze(batch: ChatAnalysisBatch, judge: AsyncMock) -> PatternResultCallback:
    with (
        patch.object(gemini_client, "judge", judge),
        # 재시도 대기를 실제로 기다리지 않는다.
        patch("asyncio.sleep", AsyncMock()),
    ):
        return asyncio.run(chat_risk_service.analyze(batch))


def test_skips_llm_when_no_signal_is_found() -> None:
    judge = AsyncMock()

    result = analyze(build_batch(HARMLESS_CONTENT), judge)

    judge.assert_not_awaited()
    assert result.status == "COMPLETED"
    assert result.isRisky is False
    assert result.reasonCode is None


def test_skips_llm_when_every_message_is_blank() -> None:
    judge = AsyncMock()

    result = analyze(build_batch("   ", "\t"), judge)

    judge.assert_not_awaited()
    assert result.isRisky is False


def test_returns_reason_code_from_verdict() -> None:
    judge = AsyncMock(
        return_value=GeminiVerdict(
            is_risky=True,
            reason_code="EXTERNAL_MESSENGER_INDUCEMENT",
        )
    )

    result = analyze(build_batch(RISKY_CONTENT), judge)

    judge.assert_awaited_once()
    assert result.status == "COMPLETED"
    assert result.isRisky is True
    assert result.reasonCode == "EXTERNAL_MESSENGER_INDUCEMENT"
    assert result.requestId == REQUEST_ID
    assert result.roomId == ROOM_ID
    assert result.analyzedAt.tzinfo is not None


# 위험 판정에 카테고리가 없으면 Back이 경고에 붙일 사유가 없어진다.
def test_falls_back_to_etc_when_verdict_has_no_reason_code() -> None:
    judge = AsyncMock(return_value=GeminiVerdict(is_risky=True, reason_code=None))

    result = analyze(build_batch(RISKY_CONTENT), judge)

    assert result.reasonCode == "ETC_SUSPICIOUS"


def test_retries_until_the_verdict_arrives() -> None:
    judge = AsyncMock(
        side_effect=[
            GeminiUnavailableError("Gemini client error: 429"),
            GeminiUnavailableError("Gemini server error: 503"),
            GeminiVerdict(is_risky=True, reason_code="FRAUD_SCAM"),
        ]
    )

    result = analyze(build_batch(RISKY_CONTENT), judge)

    assert judge.await_count == 3
    assert result.status == "COMPLETED"
    assert result.reasonCode == "FRAUD_SCAM"


def test_reports_failure_after_retries_run_out() -> None:
    judge = AsyncMock(side_effect=GeminiUnavailableError("Gemini client error: 429"))

    result = analyze(build_batch(RISKY_CONTENT), judge)

    assert judge.await_count == 3
    assert result.status == "FAILED"
    assert result.isRisky is None
    assert result.reasonCode is None


# 키·요청 문제는 다시 보내도 같은 결과라 재시도하지 않는다.
def test_gives_up_immediately_when_request_is_rejected() -> None:
    judge = AsyncMock(side_effect=GeminiRejectedError("Gemini rejected the request: 401"))

    result = analyze(build_batch(RISKY_CONTENT), judge)

    judge.assert_awaited_once()
    assert result.status == "FAILED"
    assert result.isRisky is None
