package com.yuhan.wagglewaggle.domain.pin.service;

import com.yuhan.wagglewaggle.domain.pin.dto.PinEvaluationRequest;
import com.yuhan.wagglewaggle.domain.pin.dto.PinEvaluationResponse;
import com.yuhan.wagglewaggle.domain.pin.entity.PinEvaluationType;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PinEvaluationServiceTest {

    @Mock private PinEvaluationPersistenceService pinEvaluationPersistenceService;

    private PinEvaluationService service;

    private static final Long MEMBER_ID = 42L;
    private static final String RAW_PIN_ID = "11111111-2222-3333-4444-555555555555";
    private static final UUID PIN_ID = UUID.fromString(RAW_PIN_ID);

    @BeforeEach
    void setUp() {
        service = new PinEvaluationService(pinEvaluationPersistenceService);
    }

    @Test
    void 정상_평가하면_반영_결과로_응답을_조립한다() {
        given(pinEvaluationPersistenceService.apply(PIN_ID, MEMBER_ID, PinEvaluationType.HELPFUL))
                .willReturn(new PinEvaluationPersistenceService.Result(100L, 1));

        PinEvaluationResponse response =
                service.evaluate(MEMBER_ID, RAW_PIN_ID, new PinEvaluationRequest("HELPFUL"));

        assertThat(response.evaluationId()).isEqualTo(100L);
        assertThat(response.pinId()).isEqualTo(PIN_ID);
        assertThat(response.rating()).isEqualTo(PinEvaluationType.HELPFUL);
        assertThat(response.rewardCredit()).isEqualTo(1);
    }

    @Test
    void pinId_형식이_잘못되면_INVALID_PIN_ID이고_반영하지_않는다() {
        assertThatThrownBy(() ->
                service.evaluate(MEMBER_ID, "not-a-uuid", new PinEvaluationRequest("HELPFUL")))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.INVALID_PIN_ID);

        verify(pinEvaluationPersistenceService, never()).apply(any(), any(), any());
    }

    @Test
    void rating이_null이면_INVALID_RATING이고_반영하지_않는다() {
        assertThatThrownBy(() ->
                service.evaluate(MEMBER_ID, RAW_PIN_ID, new PinEvaluationRequest(null)))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.INVALID_RATING);

        verify(pinEvaluationPersistenceService, never()).apply(any(), any(), any());
    }

    @Test
    void 요청_바디가_없으면_INVALID_RATING이다() {
        assertThatThrownBy(() -> service.evaluate(MEMBER_ID, RAW_PIN_ID, null))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.INVALID_RATING);

        verify(pinEvaluationPersistenceService, never()).apply(any(), any(), any());
    }

    @Test
    void 지원하지_않는_rating이면_INVALID_RATING이다() {
        assertThatThrownBy(() ->
                service.evaluate(MEMBER_ID, RAW_PIN_ID, new PinEvaluationRequest("GOOD")))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.INVALID_RATING);

        verify(pinEvaluationPersistenceService, never()).apply(any(), any(), any());
    }

    @Test
    void 반영_중_CustomException은_그대로_전파한다() {
        given(pinEvaluationPersistenceService.apply(eq(PIN_ID), eq(MEMBER_ID), any()))
                .willThrow(new CustomException(ErrorCode.PIN_ALREADY_EVALUATED));

        assertThatThrownBy(() ->
                service.evaluate(MEMBER_ID, RAW_PIN_ID, new PinEvaluationRequest("NOT_HELPFUL")))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.PIN_ALREADY_EVALUATED);
    }

    @Test
    void 반영_중_예상치_못한_오류는_PIN_EVALUATION_FAILED로_매핑한다() {
        given(pinEvaluationPersistenceService.apply(eq(PIN_ID), eq(MEMBER_ID), any()))
                .willThrow(new RuntimeException("DB 오류"));

        assertThatThrownBy(() ->
                service.evaluate(MEMBER_ID, RAW_PIN_ID, new PinEvaluationRequest("HELPFUL")))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.PIN_EVALUATION_FAILED);
    }
}
