import hmac
from typing import Annotated

from fastapi import Header

from app.core.config import settings


class InternalAuthError(Exception):
    pass


async def verify_internal_api_key(
    x_internal_api_key: Annotated[str | None, Header()] = None,
) -> None:
    if x_internal_api_key is None:
        raise InternalAuthError

    # 타이밍 공격으로 키가 한 글자씩 새어나가지 않도록 상수 시간 비교를 쓴다.
    if not hmac.compare_digest(
        x_internal_api_key,
        settings.internal_api_key,
    ):
        raise InternalAuthError
