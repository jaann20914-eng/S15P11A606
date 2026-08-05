import asyncio
import json
from datetime import UTC, datetime
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID

import pytest
from pydantic import ValidationError

from app.schemas.chat_risk import ChatAnalysisBatch, PatternResultCallback
from app.workers.chat_risk_worker import ChatRiskWorker

REQUEST_ID = UUID("11111111-1111-1111-1111-111111111111")
ROOM_ID = 1
SENT_AT = datetime(2026, 8, 4, 4, 12, 34, tzinfo=UTC)


def build_payload(**overrides: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "requestId": str(REQUEST_ID),
        "roomId": ROOM_ID,
        "sentAt": SENT_AT.isoformat(),
        "chatMessages": [
            {"senderId": 2, "content": "카카오톡으로 연락해 주세요."},
            {"senderId": 3, "content": "제 전화번호는..."},
        ],
    }
    payload.update(overrides)
    return payload


def build_message(body: bytes) -> MagicMock:
    message = MagicMock()
    message.body = body
    message.redelivered = False
    message.ack = AsyncMock()
    message.reject = AsyncMock()
    return message


def build_callback() -> PatternResultCallback:
    return PatternResultCallback(
        requestId=REQUEST_ID,
        roomId=ROOM_ID,
        isRisky=False,
        status="COMPLETED",
        analyzedAt=SENT_AT,
    )


# 여기서 검증하는 것은 ACK/reject 배관이라 분석은 대역으로 바꾼다.
def handle(message: MagicMock, delivered: bool = True) -> None:
    worker = ChatRiskWorker()

    with (
        patch(
            "app.workers.chat_risk_worker.chat_risk_service.analyze",
            AsyncMock(return_value=build_callback()),
        ),
        patch(
            "app.workers.chat_risk_worker.back_client.send_pattern_result",
            AsyncMock(return_value=delivered),
        ),
    ):
        asyncio.run(worker.handle_message(message))


def test_accepts_batch_in_publish_contract() -> None:
    batch = ChatAnalysisBatch.model_validate(build_payload())

    assert batch.requestId == REQUEST_ID
    assert batch.roomId == ROOM_ID
    assert batch.sentAt == SENT_AT
    assert [message.senderId for message in batch.chatMessages] == [2, 3]


@pytest.mark.parametrize(
    "overrides",
    [
        {"requestId": "not-a-uuid"},
        {"roomId": 0},
        {"sentAt": "2026-08-04T04:12:34"},
        {"chatMessages": []},
        {"chatMessages": [{"senderId": 2, "content": "가" * 501}]},
        {"chatMessages": [{"senderId": 2, "content": "안녕", "messageId": 7}]},
    ],
)
def test_rejects_batch_outside_contract(overrides: dict[str, Any]) -> None:
    with pytest.raises(ValidationError):
        ChatAnalysisBatch.model_validate(build_payload(**overrides))


def test_acks_after_callback_succeeds() -> None:
    message = build_message(json.dumps(build_payload()).encode("utf-8"))

    handle(message)

    message.ack.assert_awaited_once()
    message.reject.assert_not_awaited()


@pytest.mark.parametrize(
    "body",
    [
        b"not json at all",
        json.dumps(build_payload(requestId="not-a-uuid")).encode("utf-8"),
        json.dumps([build_payload()]).encode("utf-8"),
    ],
)
def test_rejects_unprocessable_message_to_dead_letter(body: bytes) -> None:
    message = build_message(body)

    handle(message)

    message.reject.assert_awaited_once_with(requeue=False)
    message.ack.assert_not_awaited()


# 콜백을 포기해도 ACK해야 한다. ACK하지 않으면 같은 배치가 무한히 재전달되어
# 뒤따르는 배치까지 밀린다.
def test_acks_even_when_callback_is_given_up() -> None:
    message = build_message(json.dumps(build_payload()).encode("utf-8"))

    handle(message, delivered=False)

    message.ack.assert_awaited_once()
    message.reject.assert_not_awaited()


def test_rejects_message_when_analysis_raises() -> None:
    message = build_message(json.dumps(build_payload()).encode("utf-8"))
    worker = ChatRiskWorker()

    with patch(
        "app.workers.chat_risk_worker.chat_risk_service.analyze",
        AsyncMock(side_effect=RuntimeError("analysis failed")),
    ):
        asyncio.run(worker.handle_message(message))

    message.reject.assert_awaited_once_with(requeue=False)
    message.ack.assert_not_awaited()
