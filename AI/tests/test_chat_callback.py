import asyncio
import json
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

import httpx
import pytest
from pydantic import ValidationError

from app.clients.back_client import PATTERN_RESULT_PATH, BackClient
from app.core.config import settings
from app.schemas.chat_risk import PatternResultCallback

REQUEST_ID = UUID("11111111-1111-1111-1111-111111111111")
ROOM_ID = 1

KST = timezone(timedelta(hours=9))
ANALYZED_AT = datetime(2026, 7, 27, 10, 0, 22, tzinfo=KST)

MAX_ATTEMPTS = settings.chat_callback_max_retries + 1

SUCCESS_BODY = {"statusCode": 200, "message": "분석 결과가 반영되었습니다."}


def build_result(**overrides: Any) -> PatternResultCallback:
    payload: dict[str, Any] = {
        "requestId": REQUEST_ID,
        "roomId": ROOM_ID,
        "isRisky": True,
        "reasonCode": "FRAUD_SCAM",
        "status": "COMPLETED",
        "analyzedAt": ANALYZED_AT,
    }
    payload.update(overrides)
    return PatternResultCallback.model_validate(payload)


def error_response(status_code: int, code: str) -> httpx.Response:
    return httpx.Response(
        status_code,
        json={
            "statusCode": status_code,
            "message": "요청을 처리하지 못했습니다.",
            "error": {"code": code},
        },
    )


def build_client(
    outcomes: list[httpx.Response | Exception],
) -> tuple[BackClient, list[httpx.Request]]:
    recorded: list[httpx.Request] = []
    remaining = list(outcomes)

    def handle(request: httpx.Request) -> httpx.Response:
        recorded.append(request)
        outcome = remaining.pop(0)

        if isinstance(outcome, Exception):
            raise outcome

        return outcome

    return BackClient(transport=httpx.MockTransport(handle)), recorded


def send(client: BackClient, result: PatternResultCallback) -> bool:
    async def run() -> bool:
        try:
            return await client.send_pattern_result(result)
        finally:
            await client.close()

    return asyncio.run(run())


def test_sends_callback_with_auth_header_and_spec_payload() -> None:
    client, recorded = build_client([httpx.Response(200, json=SUCCESS_BODY)])

    assert send(client, build_result()) is True
    assert len(recorded) == 1

    request = recorded[0]

    assert request.url.path == PATTERN_RESULT_PATH
    assert request.headers["x-internal-api-key"] == settings.internal_api_key
    assert json.loads(request.content) == {
        "requestId": str(REQUEST_ID),
        "roomId": ROOM_ID,
        "isRisky": True,
        "reasonCode": "FRAUD_SCAM",
        "status": "COMPLETED",
        "analyzedAt": "2026-07-27T10:00:22+09:00",
    }


def test_sends_failed_result_with_null_risk_fields() -> None:
    client, recorded = build_client([httpx.Response(200, json=SUCCESS_BODY)])
    result = build_result(isRisky=None, reasonCode=None, status="FAILED")

    assert send(client, result) is True

    body = json.loads(recorded[0].content)

    assert body["status"] == "FAILED"
    assert body["isRisky"] is None
    assert body["reasonCode"] is None


def test_retries_after_server_error() -> None:
    client, recorded = build_client(
        [
            error_response(500, "CALLBACK_PROCESSING_FAILED"),
            httpx.Response(200, json=SUCCESS_BODY),
        ]
    )

    assert send(client, build_result()) is True
    assert len(recorded) == 2


def test_retries_after_timeout() -> None:
    timeouts: list[httpx.Response | Exception] = [
        httpx.ReadTimeout("callback timed out") for _ in range(MAX_ATTEMPTS)
    ]
    client, recorded = build_client(timeouts)

    assert send(client, build_result()) is False
    assert len(recorded) == MAX_ATTEMPTS


def test_gives_up_after_max_attempts() -> None:
    failures: list[httpx.Response | Exception] = [
        error_response(500, "CALLBACK_PROCESSING_FAILED") for _ in range(MAX_ATTEMPTS)
    ]
    client, recorded = build_client(failures)

    assert send(client, build_result()) is False
    assert len(recorded) == MAX_ATTEMPTS


@pytest.mark.parametrize(
    ("status_code", "code"),
    [
        (400, "INVALID_CALLBACK_PAYLOAD"),
        (401, "UNAUTHORIZED"),
        (404, "CHAT_ROOM_NOT_FOUND"),
    ],
)
def test_does_not_retry_when_back_rejects_request(status_code: int, code: str) -> None:
    client, recorded = build_client([error_response(status_code, code)])

    assert send(client, build_result()) is False
    assert len(recorded) == 1


@pytest.mark.parametrize(
    "overrides",
    [
        {"status": "FAILED"},
        {"isRisky": None},
        {"isRisky": False},
        {"analyzedAt": datetime(2026, 7, 27, 10, 0, 22)},
    ],
)
def test_rejects_inconsistent_result(overrides: dict[str, Any]) -> None:
    with pytest.raises(ValidationError):
        build_result(**overrides)
