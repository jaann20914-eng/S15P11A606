from datetime import UTC, datetime
from uuid import UUID

import pytest

from app.pipeline.chat.infer import detect_signals
from app.pipeline.chat.preprocess import preprocess
from app.pipeline.chat.validate import collect_analyzable_messages
from app.schemas.chat_risk import ChatAnalysisBatch, ChatMessageItem

REQUEST_ID = UUID("33333333-3333-3333-3333-333333333333")
SENT_AT = datetime(2026, 8, 4, 4, 12, 34, tzinfo=UTC)


def to_messages(*messages: tuple[int, str]) -> list[ChatMessageItem]:
    return [
        ChatMessageItem(senderId=sender, content=content) for sender, content in messages
    ]


def detect(*messages: tuple[int, str]) -> set[str]:
    definitions = detect_signals(preprocess(to_messages(*messages)))
    return {definition.name for definition in definitions}


def detect_reason_codes(*messages: tuple[int, str]) -> set[str]:
    definitions = detect_signals(preprocess(to_messages(*messages)))
    return {definition.reason_code for definition in definitions}


@pytest.mark.parametrize(
    ("content", "expected_reason_code"),
    [
        ("카톡 아이디 알려주세요 거기서 얘기해요", "EXTERNAL_MESSENGER_INDUCEMENT"),
        ("https://open.kakao.com/o/abcd 들어오세요", "EXTERNAL_MESSENGER_INDUCEMENT"),
        ("국민은행 123-456-7890 으로 선입금 부탁드려요", "FRAUD_SCAM"),
        ("문화상품권으로 대리결제 해주시면 됩니다", "FRAUD_SCAM"),
        ("대마 소량 판매합니다", "ILLEGAL_GOODS_TRADE"),
        ("010-1234-5678 로 연락주세요", "ETC_SUSPICIOUS"),
    ],
)
def test_detects_expected_reason_code(content: str, expected_reason_code: str) -> None:
    assert expected_reason_code in detect_reason_codes((2, content))


# 프리필터가 여기 걸리면 일상 대화마다 문맥 판정을 호출해 쿼터를 소모한다.
@pytest.mark.parametrize(
    "content",
    [
        "점심 뭐 먹을까요",
        "안녕하세요 반갑습니다",
        "온라인으로 미리 예약했어요",
        "아이스아메리카노 두 잔 시켰습니다",
        "커피 한 잔에 5000원이더라고요",
        "이따 6시에 만나서 직거래하죠",
        "텔레비전 소리가 너무 커요",
    ],
)
def test_ignores_everyday_conversation(content: str) -> None:
    assert detect((2, content)) == set()


def test_detects_messenger_name_with_inserted_spaces() -> None:
    assert "messenger_name" in detect((2, "카 톡으로 연락주세요"))


def test_detects_phone_number_split_across_messages() -> None:
    assert "phone_number" in detect((2, "제 번호는 010"), (2, "1234"), (2, "5678"))


# 발신자별로만 이어 붙이기 때문에 서로 다른 사람이 말한 숫자는 합쳐지지 않는다.
def test_ignores_digits_split_across_different_senders() -> None:
    assert "phone_number" not in detect((2, "010"), (3, "1234"), (4, "5678"))


def test_detects_digits_spelled_in_korean() -> None:
    assert "spelled_out_digits" in detect((2, "공일공 일이삼사 오육칠팔"))


def test_drops_messages_without_content() -> None:
    batch = ChatAnalysisBatch(
        requestId=REQUEST_ID,
        roomId=1,
        sentAt=SENT_AT,
        chatMessages=to_messages((2, "   "), (3, "안녕하세요")),
    )

    remaining = collect_analyzable_messages(batch)

    assert [message.content for message in remaining] == ["안녕하세요"]


def test_transcript_replaces_real_sender_ids_with_labels() -> None:
    transcript = preprocess(to_messages((77, "안녕하세요"), (88, "반갑습니다"))).transcript

    assert transcript == "[발신자1] 안녕하세요\n[발신자2] 반갑습니다"
