package com.yuhan.wagglewaggle.domain.pin.service;

import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJob;
import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJobStatus;
import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJobType;
import com.yuhan.wagglewaggle.domain.blur.publisher.AiBlurJobPublisher;
import com.yuhan.wagglewaggle.domain.blur.repository.AiBlurJobRepository;
import com.yuhan.wagglewaggle.domain.pin.dto.PinUpdateRequest;
import com.yuhan.wagglewaggle.domain.pin.dto.PinUpdateResponse;
import com.yuhan.wagglewaggle.domain.pin.dto.ValidatedPinUpdate;
import com.yuhan.wagglewaggle.domain.pin.entity.VideoStatus;
import com.yuhan.wagglewaggle.domain.pin.tag.service.PinTagIndexingService;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import com.yuhan.wagglewaggle.global.jackson.PatchField;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PinUpdateServiceTest {

    @Mock private PinUpdateValidator pinUpdateValidator;
    @Mock private ReplacementVideoValidator replacementVideoValidator;
    @Mock private AiBlurJobRepository aiBlurJobRepository;
    @Mock private PinUpdatePersistenceService pinUpdatePersistenceService;
    @Mock private AiBlurJobPublisher aiBlurJobPublisher;
    @Mock private PinTagIndexingService pinTagIndexingService;

    private PinUpdateService service;

    private static final Long MEMBER_ID = 42L;
    private static final String RAW_PIN_ID = "11111111-2222-3333-4444-555555555555";
    private static final UUID PIN_ID = UUID.fromString(RAW_PIN_ID);
    private static final String VIDEO_KEY = "pins/original/42/bbb.mp4";

    @BeforeEach
    void setUp() {
        service = new PinUpdateService(pinUpdateValidator, replacementVideoValidator,
                aiBlurJobRepository, pinUpdatePersistenceService, aiBlurJobPublisher, pinTagIndexingService);
        given(aiBlurJobRepository.existsByPinIdAndJobTypeAndStatus(any(), any(), any())).willReturn(false);
    }

    private PinUpdateRequest generalRequest() {
        return new PinUpdateRequest(PatchField.absent(), PatchField.absent(), PatchField.absent(),
                PatchField.absent(), PatchField.absent(), PatchField.absent(),
                PatchField.of("새 메모"), PatchField.absent());
    }

    private PinUpdateRequest videoRequest() {
        return new PinUpdateRequest(PatchField.of(VIDEO_KEY), PatchField.absent(), PatchField.absent(),
                PatchField.absent(), PatchField.of("2층 창가"), PatchField.absent(),
                PatchField.absent(), PatchField.absent());
    }

    private ValidatedPinUpdate validated() {
        return new ValidatedPinUpdate(PIN_ID, MEMBER_ID, PatchField.absent(), null, false,
                0, 0, false, PatchField.absent(), PatchField.absent(), PatchField.absent(),
                PatchField.absent());
    }

    private void givenValidatorReturns() {
        given(pinUpdateValidator.validate(eq(MEMBER_ID), eq(RAW_PIN_ID), any())).willReturn(validated());
    }

    @Test
    void 일반_정보만_수정하면_발행하지_않고_generalOnly_응답을_반환한다() {
        givenValidatorReturns();
        given(pinUpdatePersistenceService.apply(any(), eq(null)))
                .willReturn(new PinUpdatePersistenceService.Result(
                        VideoStatus.ACTIVE, List.of("memo"), null));

        PinUpdateResponse response = service.update(MEMBER_ID, RAW_PIN_ID, generalRequest());

        assertThat(response.isVideoReplacementAccepted()).isFalse();
        assertThat(response.videoReplacementStatus()).isNull();
        assertThat(response.pendingFields()).isNull();
        assertThat(response.updatedFields()).containsExactly("memo");
        verify(aiBlurJobPublisher, never()).publish(any());
        verify(replacementVideoValidator, never()).validate(any(), any());
        // 태그가 바뀌지 않았으므로 검색 인덱스를 갱신하지 않는다.
        verify(pinTagIndexingService, never()).indexPinTags(any());
    }

    @Test
    void 태그가_바뀌면_커밋_이후_검색_인덱스를_갱신한다() {
        givenValidatorReturns();
        given(pinUpdatePersistenceService.apply(any(), eq(null)))
                .willReturn(new PinUpdatePersistenceService.Result(
                        VideoStatus.ACTIVE, List.of("tags"), null));

        service.update(MEMBER_ID, RAW_PIN_ID, generalRequest());

        // 저장(apply) 커밋 이후 해당 핀 태그를 재색인한다.
        InOrder inOrder = inOrder(pinUpdatePersistenceService, pinTagIndexingService);
        inOrder.verify(pinUpdatePersistenceService).apply(any(), eq(null));
        inOrder.verify(pinTagIndexingService).indexPinTags(PIN_ID);
    }

    @Test
    void 태그_재색인이_실패해도_수정_결과_응답을_반환한다() {
        givenValidatorReturns();
        given(pinUpdatePersistenceService.apply(any(), eq(null)))
                .willReturn(new PinUpdatePersistenceService.Result(
                        VideoStatus.ACTIVE, List.of("tags"), null));
        org.mockito.BDDMockito.willThrow(new RuntimeException("ES 오류"))
                .given(pinTagIndexingService).indexPinTags(any());

        PinUpdateResponse response = service.update(MEMBER_ID, RAW_PIN_ID, generalRequest());

        assertThat(response.updatedFields()).containsExactly("tags");
    }

    @Test
    void 영상_교체면_커밋_이후_발행하고_withReplacement_응답을_반환한다() {
        givenValidatorReturns();
        AiBlurJob job = AiBlurJob.create(PIN_ID, VIDEO_KEY, AiBlurJobType.VIDEO_REPLACEMENT);
        given(pinUpdatePersistenceService.apply(any(), eq(VIDEO_KEY)))
                .willReturn(new PinUpdatePersistenceService.Result(
                        VideoStatus.ACTIVE, List.of("detailLocation"), job));

        PinUpdateResponse response = service.update(MEMBER_ID, RAW_PIN_ID, videoRequest());

        assertThat(response.isVideoReplacementAccepted()).isTrue();
        assertThat(response.videoReplacementStatus()).isEqualTo(AiBlurJobStatus.PENDING);
        assertThat(response.pendingFields()).containsExactly("originalVideoKey");
        assertThat(response.updatedFields()).containsExactly("detailLocation");

        // 저장(apply)이 발행(publish)보다 먼저 일어난다 — DB 커밋 후 발행.
        InOrder inOrder = inOrder(replacementVideoValidator, pinUpdatePersistenceService, aiBlurJobPublisher);
        inOrder.verify(replacementVideoValidator).validate(MEMBER_ID, VIDEO_KEY);
        inOrder.verify(pinUpdatePersistenceService).apply(any(), eq(VIDEO_KEY));
        inOrder.verify(aiBlurJobPublisher).publish(job);
    }

    @Test
    void 진행_중_교체_작업이_있으면_반영하지_않고_PIN_UPDATE_IN_PROGRESS() {
        givenValidatorReturns();
        given(aiBlurJobRepository.existsByPinIdAndJobTypeAndStatus(
                PIN_ID, AiBlurJobType.VIDEO_REPLACEMENT, AiBlurJobStatus.PENDING)).willReturn(true);

        assertThatThrownBy(() -> service.update(MEMBER_ID, RAW_PIN_ID, videoRequest()))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.PIN_UPDATE_IN_PROGRESS);

        verify(replacementVideoValidator, never()).validate(any(), any());
        verify(pinUpdatePersistenceService, never()).apply(any(), any());
    }

    @Test
    void 반영_중_예상치_못한_오류는_PIN_UPDATE_FAILED로_매핑한다() {
        givenValidatorReturns();
        given(pinUpdatePersistenceService.apply(any(), any()))
                .willThrow(new RuntimeException("DB 오류"));

        assertThatThrownBy(() -> service.update(MEMBER_ID, RAW_PIN_ID, generalRequest()))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.PIN_UPDATE_FAILED);
    }

    @Test
    void 반영_중_CustomException은_그대로_전파한다() {
        givenValidatorReturns();
        given(pinUpdatePersistenceService.apply(any(), any()))
                .willThrow(new CustomException(ErrorCode.PIN_UPDATE_IN_PROGRESS));

        assertThatThrownBy(() -> service.update(MEMBER_ID, RAW_PIN_ID, videoRequest()))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.PIN_UPDATE_IN_PROGRESS);
    }

    @Test
    void 발행에_실패해도_수정_결과_응답을_반환한다() {
        givenValidatorReturns();
        AiBlurJob job = AiBlurJob.create(PIN_ID, VIDEO_KEY, AiBlurJobType.VIDEO_REPLACEMENT);
        given(pinUpdatePersistenceService.apply(any(), eq(VIDEO_KEY)))
                .willReturn(new PinUpdatePersistenceService.Result(
                        VideoStatus.ACTIVE, List.of(), job));
        org.mockito.BDDMockito.willThrow(new org.springframework.amqp.AmqpException("broker down"))
                .given(aiBlurJobPublisher).publish(any());

        PinUpdateResponse response = service.update(MEMBER_ID, RAW_PIN_ID, videoRequest());

        assertThat(response.isVideoReplacementAccepted()).isTrue();
        assertThat(response.updatedFields()).isEmpty();
    }
}
