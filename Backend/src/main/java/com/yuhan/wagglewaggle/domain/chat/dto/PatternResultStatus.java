package com.yuhan.wagglewaggle.domain.chat.dto;

/**
 * AI 패턴 분석 결과 콜백의 분석 수행 상태.
 * 외부(AI Worker)로부터는 최종 상태만 받는다(내부 전용 PENDING/PROCESSING은 받지 않으므로
 * AiChatJobStatus를 그대로 노출하지 않고 별도 enum으로 둔다).
 */
public enum PatternResultStatus {
    COMPLETED,
    FAILED
}
