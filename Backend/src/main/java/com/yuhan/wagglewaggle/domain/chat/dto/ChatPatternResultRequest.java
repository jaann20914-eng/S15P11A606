package com.yuhan.wagglewaggle.domain.chat.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.yuhan.wagglewaggle.domain.chat.entity.WarningReasonCode;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.UUID;

/**
 * AI Worker → Back 패턴 분석 결과 콜백 payload.
 *
 * <p>status=COMPLETED면 분석이 수행된 것이며 isRisky로 위험 여부를 판단한다(교차검증은 서비스에서).
 * status=FAILED면 분석 실패로, isRisky/reasonCode는 무시한다. roomId는 참고용이며 처리 로직은
 * requestId로 찾은 작업의 chat_room_id를 기준으로 한다. Boolean isRisky는 null(=FAILED 시)과 false를
 * 구분해야 하므로 원시 타입이 아니라 래퍼로 받는다.</p>
 */
public record ChatPatternResultRequest(
        @NotNull UUID requestId,
        Long roomId,
        @JsonProperty("isRisky") Boolean isRisky,
        WarningReasonCode reasonCode,
        @NotNull PatternResultStatus status,
        Instant analyzedAt
) {
}
