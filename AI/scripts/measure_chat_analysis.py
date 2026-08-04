"""채팅 배치 분석의 실측 지연·토큰 사용량 측정 스크립트.

실행: python -m scripts.measure_chat_analysis [반복횟수]

실제 Gemini API를 호출하므로 무료 쿼터를 소모한다.
"""

import asyncio
import statistics
import sys
import time

import httpx
from google import genai
from google.genai import errors, types

from app.clients.gemini_client import build_verdict_config
from app.core.config import settings
from app.pipeline.chat.infer import SYSTEM_INSTRUCTION, build_prompt, detect_signals
from app.pipeline.chat.preprocess import PreprocessedBatch, preprocess
from app.schemas.chat_risk import ChatMessageItem

# 무료 티어는 분당 요청 수 제한이 있어 호출 사이를 띄운다.
CALL_INTERVAL_SECONDS = 4.0

DEFAULT_REPEATS = 3

SMALL_TALK = (
    "여기 지금 사람 많아요?",
    "방금 도착했는데 웨이팅 십분 정도래요",
    "창가 쪽에 자리 났어요",
    "커피 맛있네요 추천합니다",
    "주차는 건물 뒤편에 하면 돼요",
    "오늘 날씨 좋아서 산책하기 좋네요",
    "저녁에 다시 올까 생각중이에요",
    "여기 디저트가 유명하대요",
    "사진 찍기 좋은 자리 있나요?",
    "지금은 조용해서 좋아요",
)

Message = tuple[int, str]


def small_talk(count: int) -> list[Message]:
    return [(2 + index % 3, SMALL_TALK[index % len(SMALL_TALK)]) for index in range(count)]


SCENARIOS: tuple[tuple[str, list[Message]], ...] = (
    ("정상 · 한산 5건", small_talk(5)),
    ("정상 · 보통 20건", small_talk(20)),
    ("정상 · 붐빔 50건", small_talk(50)),
    (
        "위험 · 메신저 유도 20건",
        small_talk(18)
        + [(4, "여기서 말고 카톡으로 얘기해요"), (4, "아이디 알려드릴게요")],
    ),
    (
        "위험 · 선입금 사기 20건",
        small_talk(18)
        + [(4, "국민은행 123-456-7890 입니다"), (4, "선입금 주시면 바로 보내드려요")],
    ),
    (
        "위험 · 번호 쪼개기 20건",
        small_talk(17)
        + [(4, "제 번호 알려드릴게요 010"), (4, "1234"), (4, "5678")],
    ),
)


def prepare(messages: list[Message]) -> PreprocessedBatch:
    return preprocess(
        [ChatMessageItem(senderId=sender, content=content) for sender, content in messages]
    )


def print_indented(text: str, limit: int | None = None) -> None:
    lines = text.splitlines()
    shown = lines if limit is None else lines[:limit]

    for line in shown:
        print(f"    {line}")

    if limit is not None and len(lines) > limit:
        print(f"    ... 나머지 {len(lines) - limit}줄 생략")


async def measure_scenario(
    client: genai.Client,
    name: str,
    messages: list[Message],
    repeats: int,
) -> tuple[float, float] | None:
    prepared = prepare(messages)
    signals = detect_signals(prepared)

    print(f"\n[{name}] 메시지 {len(messages)}건 · 감지 신호 {len(signals)}개")

    if not signals:
        print("  프리필터에서 무해 판정 — Gemini 미호출 (지연 0ms)")
        print_indented(prepared.transcript, limit=3)
        return None

    print("  신호:", ", ".join(signal.name for signal in signals))

    prompt = build_prompt(prepared, signals)

    print("  모델에 보낸 프롬프트:")
    print_indented(prompt)
    latencies: list[float] = []
    prompt_tokens: list[int] = []
    output_tokens: list[int] = []
    verdicts: list[str] = []

    for attempt in range(repeats):
        if attempt:
            await asyncio.sleep(CALL_INTERVAL_SECONDS)

        started_at = time.perf_counter()

        try:
            response = await client.aio.models.generate_content(
                model=settings.gemini_model,
                contents=prompt,
                config=build_verdict_config(SYSTEM_INSTRUCTION),
            )
        except (errors.APIError, httpx.HTTPError) as error:
            # 실패도 측정 대상이다. 남은 시나리오까지 못 보면 한 번에 그림이 안 나온다.
            elapsed = (time.perf_counter() - started_at) * 1000
            print(f"  {attempt + 1}회차 실패 {type(error).__name__} ({elapsed:.0f}ms 경과)")
            continue

        latencies.append((time.perf_counter() - started_at) * 1000)

        usage = response.usage_metadata
        prompt_tokens.append(usage.prompt_token_count or 0 if usage else 0)
        output_tokens.append(
            ((usage.candidates_token_count or 0) + (usage.thoughts_token_count or 0))
            if usage
            else 0
        )
        verdicts.append(str(response.parsed))

    if not latencies:
        print("  모든 호출이 실패해 측정값이 없다")
        return None

    average_latency = statistics.mean(latencies)
    average_input = statistics.mean(prompt_tokens)
    average_output = statistics.mean(output_tokens)

    print(
        f"  지연 평균 {average_latency:.0f}ms "
        f"(최소 {min(latencies):.0f} / 최대 {max(latencies):.0f}, {repeats}회)"
    )
    print(f"  토큰 평균 입력 {average_input:.0f} / 출력 {average_output:.0f}")

    for index, verdict in enumerate(verdicts, start=1):
        print(f"  판정 {index}회차: {verdict}")

    return average_latency, average_input + average_output


async def main(repeats: int) -> None:
    if not settings.gemini_api_key:
        raise SystemExit("GEMINI_API_KEY가 비어 있습니다. AI/.env를 확인하세요.")

    expected_calls = sum(
        repeats for _, messages in SCENARIOS if detect_signals(prepare(messages))
    )

    print(f"모델 {settings.gemini_model} · 시나리오 {len(SCENARIOS)}개 · 반복 {repeats}회")
    print(f"실제 API 호출 {expected_calls}회 예정 (무료 쿼터를 소모합니다)")

    client = genai.Client(
        api_key=settings.gemini_api_key,
        http_options=types.HttpOptions(
            timeout=int(settings.gemini_timeout_seconds * 1000),
            base_url=settings.gemini_base_url or None,
        ),
    )

    try:
        measurements = [
            await measure_scenario(client, name, messages, repeats)
            for name, messages in SCENARIOS
        ]
    finally:
        await client.aio.aclose()

    called = [measurement for measurement in measurements if measurement is not None]

    if not called:
        return

    print("\n=== 요약 (Gemini를 호출한 배치 기준) ===")
    print(f"평균 지연 {statistics.mean(latency for latency, _ in called):.0f}ms")
    print(f"평균 토큰 {statistics.mean(tokens for _, tokens in called):.0f} (호출 1회당)")
    print(f"프리필터 통과율 {len(called)}/{len(SCENARIOS)} 시나리오")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    asyncio.run(main(int(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_REPEATS))
