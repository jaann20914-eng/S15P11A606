import pytest

from app.core.config import settings


@pytest.fixture(autouse=True)
def block_real_gemini_calls(monkeypatch: pytest.MonkeyPatch) -> None:
    # 키가 비어 있으면 호출 전에 거부되므로 테스트가 실제 API로 나가지 않는다.
    # 판정 동작을 확인하는 테스트는 호출 자체를 직접 대역으로 바꿔 쓴다.
    monkeypatch.setattr(settings, "gemini_api_key", "")
