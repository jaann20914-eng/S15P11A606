package com.yuhan.wagglewaggle.domain.pin.dto;

import com.yuhan.wagglewaggle.domain.pin.entity.PinEvaluationType;

import java.util.UUID;

/**
 * 핀 평가 등록(POST /api/v1/pins/{pinId}/evaluation)의 외부 응답 DTO.
 *
 * <p>생성된 평가 식별자와 대상 핀, 등록된 평가 값, 평가자에게 지급된 크레딧(정상 최초 평가 시 1)을 반환한다.
 * {@code pinId}는 요청 경로의 pinId와 동일하다.</p>
 */
public record PinEvaluationResponse(
        Long evaluationId,
        UUID pinId,
        PinEvaluationType rating,
        int rewardCredit
) {
}
