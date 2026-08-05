import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest
from google.genai import errors

from app.clients.gemini_client import (
    GeminiClient,
    GeminiRejectedError,
    GeminiUnavailableError,
    GeminiVerdict,
)
from app.core.config import settings

SYSTEM_INSTRUCTION = "너는 채팅방을 검사하는 감시자다."
TRANSCRIPT = "[발신자1] 카톡 아이디 알려주세요"

QUOTA_BODY = {"error": {"message": "quota exceeded", "status": "RESOURCE_EXHAUSTED"}}
AUTH_BODY = {"error": {"message": "invalid api key", "status": "UNAUTHENTICATED"}}
OUTAGE_BODY = {"error": {"message": "overloaded", "status": "UNAVAILABLE"}}


def build_sdk_client(outcome: object) -> MagicMock:
    sdk_client = MagicMock()

    if isinstance(outcome, Exception):
        sdk_client.aio.models.generate_content = AsyncMock(side_effect=outcome)
        return sdk_client

    response = MagicMock()
    response.parsed = outcome
    sdk_client.aio.models.generate_content = AsyncMock(return_value=response)

    return sdk_client


def judge(sdk_client: MagicMock, monkeypatch: pytest.MonkeyPatch) -> GeminiVerdict:
    monkeypatch.setattr(settings, "gemini_api_key", "test-key")

    with patch("app.clients.gemini_client.genai.Client", return_value=sdk_client):
        return asyncio.run(GeminiClient().judge(SYSTEM_INSTRUCTION, TRANSCRIPT))


def test_returns_parsed_verdict(monkeypatch: pytest.MonkeyPatch) -> None:
    expected = GeminiVerdict(is_risky=True, reason_code="FRAUD_SCAM")

    assert judge(build_sdk_client(expected), monkeypatch) == expected


def test_requests_deterministic_json_verdict(monkeypatch: pytest.MonkeyPatch) -> None:
    sdk_client = build_sdk_client(GeminiVerdict(is_risky=False))

    judge(sdk_client, monkeypatch)

    config = sdk_client.aio.models.generate_content.await_args.kwargs["config"]
    assert config.temperature == 0
    assert config.response_mime_type == "application/json"
    assert config.response_schema is GeminiVerdict


@pytest.mark.parametrize(
    ("failure", "expected_error"),
    [
        (errors.ClientError(429, QUOTA_BODY), GeminiUnavailableError),
        (errors.ClientError(401, AUTH_BODY), GeminiRejectedError),
        (errors.ClientError(400, AUTH_BODY), GeminiRejectedError),
        (errors.ServerError(503, OUTAGE_BODY), GeminiUnavailableError),
        (httpx.ReadTimeout("timed out"), GeminiUnavailableError),
        (httpx.ConnectError("connection refused"), GeminiUnavailableError),
    ],
)
def test_classifies_failures(
    failure: Exception,
    expected_error: type[Exception],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    with pytest.raises(expected_error):
        judge(build_sdk_client(failure), monkeypatch)


# 스키마를 강제했는데도 형식이 어긋나면 응답이 잘린 것이라 다시 시도할 값이 있다.
def test_treats_unparsable_response_as_retryable(monkeypatch: pytest.MonkeyPatch) -> None:
    with pytest.raises(GeminiUnavailableError):
        judge(build_sdk_client(None), monkeypatch)


def test_does_not_call_api_without_key(monkeypatch: pytest.MonkeyPatch) -> None:
    sdk_client = build_sdk_client(GeminiVerdict(is_risky=False))
    monkeypatch.setattr(settings, "gemini_api_key", "")

    with patch("app.clients.gemini_client.genai.Client", return_value=sdk_client):
        with pytest.raises(GeminiRejectedError):
            asyncio.run(GeminiClient().judge(SYSTEM_INSTRUCTION, TRANSCRIPT))

    sdk_client.aio.models.generate_content.assert_not_awaited()
