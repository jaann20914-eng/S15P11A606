import httpx
from google import genai
from google.genai import errors, types
from pydantic import BaseModel

from app.core.config import settings
from app.schemas.chat_risk import ReasonCode

# 키·권한·요청 형식 문제라 같은 요청을 다시 보내도 결과가 같다.
# 429는 분당 제한이라 잠시 뒤 풀릴 수 있으므로 여기 넣지 않는다.
NON_RETRYABLE_STATUS_CODES = frozenset({400, 401, 403, 404})


class GeminiError(Exception):
    pass


# 타임아웃·5xx·429처럼 다시 시도해볼 수 있는 실패.
class GeminiUnavailableError(GeminiError):
    pass


# 재시도해도 같은 결과인 실패.
class GeminiRejectedError(GeminiError):
    pass


# 모델이 이 형식으로만 답하도록 강제하는 응답 스키마다.
class GeminiVerdict(BaseModel):
    is_risky: bool
    reason_code: ReasonCode | None = None


def build_verdict_config(system_instruction: str) -> types.GenerateContentConfig:
    return types.GenerateContentConfig(
        system_instruction=system_instruction,
        # 같은 대화에 같은 판정이 나오도록 고정한다.
        temperature=0,
        response_mime_type="application/json",
        response_schema=GeminiVerdict,
    )


class GeminiClient:
    def __init__(self) -> None:
        self._client: genai.Client | None = None

    def _require_client(self) -> genai.Client:
        if not settings.gemini_api_key:
            raise GeminiRejectedError("Gemini API key is not configured.")

        if self._client is None:
            self._client = genai.Client(
                api_key=settings.gemini_api_key,
                http_options=types.HttpOptions(
                    # SDK는 타임아웃을 밀리초로 받는다.
                    timeout=int(settings.gemini_timeout_seconds * 1000),
                    base_url=settings.gemini_base_url or None,
                ),
            )

        return self._client

    async def close(self) -> None:
        if self._client is None:
            return

        await self._client.aio.aclose()
        self._client = None

    async def judge(self, system_instruction: str, transcript: str) -> GeminiVerdict:
        client = self._require_client()

        try:
            response = await client.aio.models.generate_content(
                model=settings.gemini_model,
                contents=transcript,
                config=build_verdict_config(system_instruction),
            )
        except errors.ClientError as error:
            if error.code in NON_RETRYABLE_STATUS_CODES:
                raise GeminiRejectedError(f"Gemini rejected the request: {error.code}") from error

            raise GeminiUnavailableError(f"Gemini client error: {error.code}") from error
        except errors.ServerError as error:
            raise GeminiUnavailableError(f"Gemini server error: {error.code}") from error
        except httpx.HTTPError as error:
            raise GeminiUnavailableError(
                f"Gemini request failed: {type(error).__name__}"
            ) from error

        verdict = response.parsed

        # 스키마를 강제했는데도 형식이 어긋나면 응답이 잘린 경우다.
        if not isinstance(verdict, GeminiVerdict):
            raise GeminiUnavailableError("Gemini response did not match the verdict schema.")

        return verdict


gemini_client = GeminiClient()
