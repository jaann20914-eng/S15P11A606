from app.schemas.chat_risk import ChatAnalysisBatch, ChatMessageItem


def collect_analyzable_messages(batch: ChatAnalysisBatch) -> list[ChatMessageItem]:
    # 공백만 있는 메시지는 판정 근거가 되지 않는다. 전부 걸러져 0건이 되어도
    # 계약 위반이 아니라 분석할 내용이 없는 것이므로 예외를 던지지 않는다.
    return [message for message in batch.chatMessages if message.content.strip()]
