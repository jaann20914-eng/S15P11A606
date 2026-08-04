from dataclasses import dataclass

from app.clients.gemini_client import gemini_client
from app.pipeline.chat.preprocess import PreprocessedBatch
from app.pipeline.chat.signals import SIGNAL_DEFINITIONS, SignalDefinition
from app.schemas.chat_risk import ReasonCode


@dataclass(frozen=True)
class InferResult:
    is_risky: bool
    reason_code: ReasonCode | None
    # 프리필터가 얼마나 걸러내는지 로그로 확인하기 위한 값이다.
    used_llm: bool


SYSTEM_INSTRUCTION = """너는 장소 공유 앱의 익명 채팅방을 검사하는 감시자다.
판정 결과는 채팅방에 경고를 띄우는 데만 쓰이고 사용자를 제재하지 않는다.

판정 규칙
- 대화 전체를 보고 범죄 의심 패턴이 있는지 한 번만 판정한다.
- 애매하면 무해(is_risky=false)로 판정한다. 놓치는 것보다 잘못된 경고가 더 해롭다.
- 위험하면 가장 지배적인 카테고리 하나만 reason_code에 담는다.
- 무해하면 reason_code는 비운다.

카테고리(reason_code)
- EXTERNAL_MESSENGER_INDUCEMENT: 앱 밖 메신저나 연락처로 대화를 옮기려 유도한다.
  예) "카톡 아이디 알려주세요, 거기서 얘기해요"
- FRAUD_SCAM: 금전 사기다. 계좌·선입금 요구, 결제 우회, 미끼 매물을 포함한다.
  예) "선입금 주시면 바로 보내드려요"
- ILLEGAL_GOODS_TRADE: 불법 물품이나 서비스를 사고팔려 한다.
  예) 마약·총기·위조품 거래를 흥정하는 대화
- ETC_SUSPICIOUS: 위 셋에 맞지 않지만 수상한 패턴이다.
  예) 전화번호를 여러 메시지로 쪼개 전달한다

주의
- 장소·맛집·약속 이야기, 가격 흥정, 만나서 직거래하자는 말 자체는 무해하다.
- 룰 탐지기가 찾은 신호를 함께 준다. 그 단어가 있다는 사실만으로 위험하다고
  판정하지 말고, 대화의 의도를 보고 판단한다."""


def detect_signals(batch: PreprocessedBatch) -> list[SignalDefinition]:
    return [
        definition
        for definition in SIGNAL_DEFINITIONS
        if any(definition.pattern.search(target) for target in batch.search_targets)
    ]


def build_prompt(batch: PreprocessedBatch, signals: list[SignalDefinition]) -> str:
    detected = ", ".join(f"{signal.name}({signal.reason_code})" for signal in signals)

    return f"감지된 신호: {detected}\n\n대화:\n{batch.transcript}"


async def infer(batch: PreprocessedBatch) -> InferResult:
    signals = detect_signals(batch)

    # 의심 신호가 없으면 문맥 판정까지 갈 이유가 없다. 대부분의 배치가 여기서 끝난다.
    if not signals:
        return InferResult(is_risky=False, reason_code=None, used_llm=False)

    verdict = await gemini_client.judge(SYSTEM_INSTRUCTION, build_prompt(batch, signals))

    if not verdict.is_risky:
        return InferResult(is_risky=False, reason_code=None, used_llm=True)

    # 위험 판정에 카테고리가 비어 오면 경고를 띄울 근거가 사라지므로 기타로 채운다.
    return InferResult(
        is_risky=True,
        reason_code=verdict.reason_code or "ETC_SUSPICIOUS",
        used_llm=True,
    )
