package com.yuhan.wagglewaggle.domain.chat.dto;

/**
 * 채팅 요청 응답(결정) Response.
 *
 * <p>roomId는 요청 Path의 roomId와 동일하며, status는 최종 요청 상태를
 * API 표기(ACCEPTED/REJECTED/LEFT)로 반환한다.</p>
 */
public record ChatDecisionResponse(Long roomId, String status) {
}
