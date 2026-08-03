package com.yuhan.wagglewaggle.domain.pin.service;

import com.yuhan.wagglewaggle.domain.pin.dto.PinEvaluationRequest;
import com.yuhan.wagglewaggle.domain.pin.dto.PinEvaluationResponse;
import com.yuhan.wagglewaggle.domain.pin.entity.PinEvaluationType;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * 핀 평가(POST /api/v1/pins/{pinId}/evaluation) 애플리케이션 서비스.
 *
 * <p>pinId 형식 검증(INVALID_PIN_ID) → rating 값 검증(INVALID_RATING) →
 * 반영 트랜잭션({@link PinEvaluationPersistenceService})을 오케스트레이션한다.</p>
 *
 * <p>검증 예외(CustomException: INVALID_PIN_ID·INVALID_RATING·PIN_NOT_FOUND·
 * PIN_EVALUATION_FORBIDDEN·PIN_ALREADY_EVALUATED)는 그대로 전파하고,
 * 예상치 못한 반영 실패는 롤백 후 PIN_EVALUATION_FAILED(500)로 매핑한다.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PinEvaluationService {

    private final PinEvaluationPersistenceService pinEvaluationPersistenceService;

    public PinEvaluationResponse evaluate(Long memberId, String rawPinId, PinEvaluationRequest request) {
        UUID pinId = parsePinId(rawPinId);
        PinEvaluationType rating = parseRating(request);

        PinEvaluationPersistenceService.Result result;
        try {
            result = pinEvaluationPersistenceService.apply(pinId, memberId, rating);
        } catch (CustomException e) {
            throw e;
        } catch (Exception e) {
            log.error("핀 평가 반영 실패 (pinId={}, memberId={})", pinId, memberId, e);
            throw new CustomException(ErrorCode.PIN_EVALUATION_FAILED);
        }

        return new PinEvaluationResponse(result.evaluationId(), pinId, rating, result.rewardCredit());
    }

    private UUID parsePinId(String rawPinId) {
        if (rawPinId == null || rawPinId.isBlank()) {
            throw new CustomException(ErrorCode.INVALID_PIN_ID);
        }
        try {
            return UUID.fromString(rawPinId.trim());
        } catch (IllegalArgumentException e) {
            throw new CustomException(ErrorCode.INVALID_PIN_ID);
        }
    }

    private PinEvaluationType parseRating(PinEvaluationRequest request) {
        if (request == null || request.rating() == null || request.rating().isBlank()) {
            throw new CustomException(ErrorCode.INVALID_RATING);
        }
        try {
            return PinEvaluationType.valueOf(request.rating().trim());
        } catch (IllegalArgumentException e) {
            throw new CustomException(ErrorCode.INVALID_RATING);
        }
    }
}
