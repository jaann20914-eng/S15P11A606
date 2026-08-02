package com.yuhan.wagglewaggle.domain.pin.dto;

/**
 * 핀 평가(POST /api/v1/pins/{pinId}/evaluation) 요청.
 * rating 검증은 서비스에서 통일 처리(지원하지 않는 값이면 INVALID_RATING 반환)하므로
 * Bean Validation 애노테이션을 두지 않는다. rating은 HELPFUL·NOT_HELPFUL 중 하나여야 한다.
 */
public record PinEvaluationRequest(
        String rating
) {
}
