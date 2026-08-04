import re
from dataclasses import dataclass

from app.schemas.chat_risk import ReasonCode


@dataclass(frozen=True)
class SignalDefinition:
    name: str
    # 문맥 판정 단계에 "이런 쪽이 의심된다"고 넘기는 힌트다. 최종 판정은 아니다.
    reason_code: ReasonCode
    pattern: re.Pattern[str]


def _pattern(*fragments: str) -> re.Pattern[str]:
    return re.compile("|".join(fragments), re.IGNORECASE)


# 프리필터는 무해한 배치를 걸러내기만 한다. 여기 걸린 것은 의심 확정이 아니라
# 문맥 판정으로 넘길 후보이므로, 애매하면 넓게 잡는 쪽을 택한다.
SIGNAL_DEFINITIONS: tuple[SignalDefinition, ...] = (
    SignalDefinition(
        name="messenger_name",
        reason_code="EXTERNAL_MESSENGER_INDUCEMENT",
        # 온라인·오프라인의 "라인", 텔레비전의 "텔레"는 제외한다.
        pattern=_pattern(
            "카톡", "카카오톡", "깨톡", "ㅋㅌ", "오픈채팅", "오픈챗", "오카방",
            "텔레그램", "텔레(?!비)", "(?<![온프])라인", "인스타", "디엠", "왓츠앱", "위챗",
        ),
    ),
    SignalDefinition(
        name="external_link",
        reason_code="EXTERNAL_MESSENGER_INDUCEMENT",
        pattern=_pattern(r"https?://", r"open\.kakao\.com", r"t\.me/"),
    ),
    SignalDefinition(
        name="contact_handle",
        reason_code="EXTERNAL_MESSENGER_INDUCEMENT",
        # 영문 약어는 다른 단어에 섞여 오탐하므로(video의 id) 단어 경계를 강제한다.
        # 공백을 지운 정규화본에서는 경계가 사라져 원문에서만 걸린다.
        pattern=_pattern("아이디", "친추", "친구추가", "연락처", r"\b(?:dm|id)\b"),
    ),
    SignalDefinition(
        name="phone_number",
        reason_code="ETC_SUSPICIOUS",
        pattern=_pattern(r"01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}"),
    ),
    SignalDefinition(
        name="spelled_out_digits",
        reason_code="ETC_SUSPICIOUS",
        # 숫자를 한글로 적어 정규식을 피하는 우회("공일공 일이삼사").
        pattern=_pattern(r"(?:[공영일이삼사오육칠팔구]\s*){7,}"),
    ),
    SignalDefinition(
        name="long_digit_run",
        reason_code="ETC_SUSPICIOUS",
        # 번호를 여러 메시지로 쪼갠 경우 정규화본에서 하나로 붙어 여기 걸린다.
        pattern=_pattern(r"\d{9,}"),
    ),
    SignalDefinition(
        name="money_transfer",
        reason_code="FRAUD_SCAM",
        pattern=_pattern("계좌", "입금", "송금", "이체", "예약금", "보증금", "선결제", "선불"),
    ),
    SignalDefinition(
        name="bank_name",
        reason_code="FRAUD_SCAM",
        # "우리", "하나"는 일상어라 은행이 붙은 형태만 잡는다.
        pattern=_pattern(
            r"(?:국민|신한|우리|하나|농협|기업|새마을|수협)\s*은행",
            "카카오뱅크", "케이뱅크", "토스뱅크",
        ),
    ),
    SignalDefinition(
        name="account_number_shape",
        reason_code="FRAUD_SCAM",
        pattern=_pattern(r"\d{2,6}[-\s]\d{2,6}[-\s]\d{2,6}"),
    ),
    SignalDefinition(
        name="payment_detour",
        reason_code="FRAUD_SCAM",
        pattern=_pattern("안전결제", "대리결제", "문화상품권", "문상", "기프티콘", "상품권"),
    ),
    SignalDefinition(
        name="illegal_goods",
        reason_code="ILLEGAL_GOODS_TRADE",
        # 은어(떨·아이스 등)는 "떨어지다", "아이스아메리카노" 같은 일상어에 걸려 뺐다.
        # 실제 거래는 계좌·메신저 유도 신호를 동반하는 경우가 많아 그쪽에서 걸린다.
        pattern=_pattern(
            "대마", "마약", "필로폰", "엑스터시", "장기매매", "총기", "짝퉁", "레플리카",
        ),
    ),
)
