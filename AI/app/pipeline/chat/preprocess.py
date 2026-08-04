import re
from dataclasses import dataclass

from app.schemas.chat_risk import ChatMessageItem

# 한글·자모·영문·숫자만 남긴다. "카 톡" -> "카톡", "0 1 0-1 2 3 4" -> "0101234"
_NOISE_PATTERN = re.compile(r"[^0-9A-Za-z가-힣ㄱ-ㅎ]+")


@dataclass(frozen=True)
class PreprocessedBatch:
    # 문맥 판정에 넘길 대화록.
    transcript: str
    # 프리필터가 신호를 찾을 대상. 원문과 정규화본을 함께 둔다.
    search_targets: tuple[str, ...]


def _normalize(text: str) -> str:
    return _NOISE_PATTERN.sub("", text)


def preprocess(messages: list[ChatMessageItem]) -> PreprocessedBatch:
    speaker_labels: dict[int, str] = {}
    lines: list[str] = []
    contents_by_sender: dict[int, list[str]] = {}

    for message in messages:
        content = message.content.strip()

        # 실제 senderId 대신 배치 안에서의 등장 순서를 쓴다. 화자 구분에는 충분하고
        # 외부 모델에 사용자 식별자를 넘길 이유가 없다.
        if message.senderId not in speaker_labels:
            speaker_labels[message.senderId] = f"발신자{len(speaker_labels) + 1}"

        lines.append(f"[{speaker_labels[message.senderId]}] {content}")
        contents_by_sender.setdefault(message.senderId, []).append(content)

    # 번호·계좌를 여러 메시지로 쪼개는 우회를 잡으려면 발신자별로 이어 붙여야 한다.
    # 배치 전체를 붙이면 다른 사람이 말한 숫자끼리 이어져 오탐이 난다.
    merged_by_sender = tuple(
        _normalize(" ".join(contents)) for contents in contents_by_sender.values()
    )

    transcript = "\n".join(lines)

    return PreprocessedBatch(
        transcript=transcript,
        search_targets=(transcript, *merged_by_sender),
    )
