package com.yuhan.wagglewaggle.domain.chat.dto;

/**
 * 채팅 요청 응답(결정) Request.
 *
 * <p>검증은 서비스에서 통일 처리(정확한 오류 코드 반환)하므로 Bean Validation 애노테이션을 두지 않는다.
 * decision은 String으로 받아 서비스에서 {@link ChatDecision}으로 파싱하며,
 * 누락·형식 오류 시 {@code INVALID_CHAT_DECISION}으로 반환한다.</p>
 */
public record ChatDecisionRequest(String decision) {
}
