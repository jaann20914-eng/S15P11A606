package com.yuhan.wagglewaggle.domain.blur.service;

import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJob;
import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJobStatus;
import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJobType;
import com.yuhan.wagglewaggle.domain.blur.message.AiBlurResultMessage;
import com.yuhan.wagglewaggle.domain.blur.message.AiBlurResultMessageValidator;
import com.yuhan.wagglewaggle.domain.blur.message.FinalStatus;
import com.yuhan.wagglewaggle.domain.blur.message.ProcessingStatus;
import com.yuhan.wagglewaggle.domain.blur.repository.AiBlurJobRepository;
import com.yuhan.wagglewaggle.domain.pin.entity.CrowdLevel;
import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import com.yuhan.wagglewaggle.domain.pin.entity.VideoStatus;
import com.yuhan.wagglewaggle.domain.pin.repository.PinRepository;
import com.yuhan.wagglewaggle.domain.place.entity.Place;
import com.yuhan.wagglewaggle.domain.user.entity.Member;
import com.yuhan.wagglewaggle.global.s3.S3ObjectInspector;
import com.yuhan.wagglewaggle.global.s3.S3VideoObjectMetadata;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.PrecisionModel;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * AI 블러 결과 상태 반영 서비스 단위 테스트.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AiBlurResultServiceTest {

    @Mock private AiBlurJobRepository aiBlurJobRepository;
    @Mock private PinRepository pinRepository;
    @Mock private S3ObjectInspector s3ObjectInspector;

    private AiBlurResultService service;

    private static final UUID REQUEST_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    // 작업(job)에 저장된 pinId. 상태 변경은 반드시 이 값으로 조회해야 한다.
    private static final UUID DB_PIN_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
    // 메시지에 담긴 pinId(추적용). DB_PIN_ID와 달라도 무시해야 한다.
    private static final UUID MSG_PIN_ID = UUID.fromString("99999999-9999-9999-9999-999999999999");
    private static final Instant COMPLETED_AT = Instant.parse("2026-07-31T12:00:00Z");
    private static final String ORIGINAL_KEY = "pins/original/42/33333333-3333-3333-3333-333333333333.mp4";
    private static final String BLURRED_KEY = "pins/blurred/42/44444444-4444-4444-4444-444444444444.mp4";
    private static final String THUMBNAIL_KEY = "pins/thumbnail/42/55555555-5555-5555-5555-555555555555.jpg";

    private static final GeometryFactory GF = new GeometryFactory(new PrecisionModel(), 4326);

    @BeforeEach
    void setUp() {
        service = new AiBlurResultService(
                new AiBlurResultMessageValidator(), aiBlurJobRepository, pinRepository, s3ObjectInspector);
    }

    // ---------- 헬퍼 ----------

    private AiBlurJob job(AiBlurJobType jobType, AiBlurJobStatus status, UUID pinId) {
        AiBlurJob job = AiBlurJob.create(pinId, ORIGINAL_KEY, jobType);
        ReflectionTestUtils.setField(job, "requestId", REQUEST_ID);
        ReflectionTestUtils.setField(job, "status", status);
        return job;
    }

    private Pin pendingPin() {
        Pin pin = Pin.create(
                org.mockito.Mockito.mock(Member.class),
                org.mockito.Mockito.mock(Place.class),
                CrowdLevel.WAGLE,
                GF.createPoint(new Coordinate(127.0, 37.5)),
                null, null, ORIGINAL_KEY, null);
        ReflectionTestUtils.setField(pin, "id", DB_PIN_ID);
        return pin;
    }

    private AiBlurResultMessage passMessage() {
        return new AiBlurResultMessage(REQUEST_ID, MSG_PIN_ID, ProcessingStatus.COMPLETED, FinalStatus.PASS,
                BLURRED_KEY, THUMBNAIL_KEY, null, null, List.of(), 3, 3, 3, 0, 12.5, COMPLETED_AT);
    }

    private AiBlurResultMessage failMessage() {
        return new AiBlurResultMessage(REQUEST_ID, MSG_PIN_ID, ProcessingStatus.COMPLETED, FinalStatus.FAIL,
                null, null, "FACE_NOT_BLURRED", null, List.of("LOW_CONFIDENCE"), 3, 1, 1, 2, 8.0, COMPLETED_AT);
    }

    private AiBlurResultMessage failedMessage() {
        return new AiBlurResultMessage(REQUEST_ID, MSG_PIN_ID, ProcessingStatus.FAILED, null,
                null, null, null, "INTERNAL_ERROR", null, null, null, null, null, null, COMPLETED_AT);
    }

    private void objectsExist(boolean blurred, boolean thumbnail) {
        given(s3ObjectInspector.findObjectMetadata(BLURRED_KEY))
                .willReturn(blurred ? Optional.of(new S3VideoObjectMetadata("video/mp4", 100L)) : Optional.empty());
        given(s3ObjectInspector.findObjectMetadata(THUMBNAIL_KEY))
                .willReturn(thumbnail ? Optional.of(new S3VideoObjectMetadata("image/jpeg", 100L)) : Optional.empty());
    }

    // ---------- PASS ----------

    @Test
    void PASS_영상과_썸네일이_존재하면_ACTIVE로_반영한다() {
        AiBlurJob job = job(AiBlurJobType.INITIAL_UPLOAD, AiBlurJobStatus.PENDING, DB_PIN_ID);
        Pin pin = pendingPin();
        given(aiBlurJobRepository.findById(REQUEST_ID)).willReturn(Optional.of(job));
        given(pinRepository.findById(DB_PIN_ID)).willReturn(Optional.of(pin));
        objectsExist(true, true);

        AiBlurResultOutcome outcome = service.apply(passMessage());

        assertThat(outcome).isEqualTo(AiBlurResultOutcome.APPLIED);
        assertThat(pin.getVideoStatus()).isEqualTo(VideoStatus.ACTIVE);
        assertThat(pin.getBlurredVideoKey()).isEqualTo(BLURRED_KEY);
        assertThat(pin.getThumbnailKey()).isEqualTo(THUMBNAIL_KEY);
        assertThat(pin.getExpiresAt()).isEqualTo(COMPLETED_AT.plusSeconds(3600));
        assertThat(job.getStatus()).isEqualTo(AiBlurJobStatus.COMPLETED);
        assertThat(job.getCompletedAt()).isEqualTo(COMPLETED_AT);
    }

    @Test
    void PASS_영상_객체가_없으면_DB를_변경하지_않는다() {
        AiBlurJob job = job(AiBlurJobType.INITIAL_UPLOAD, AiBlurJobStatus.PENDING, DB_PIN_ID);
        Pin pin = pendingPin();
        given(aiBlurJobRepository.findById(REQUEST_ID)).willReturn(Optional.of(job));
        given(pinRepository.findById(DB_PIN_ID)).willReturn(Optional.of(pin));
        objectsExist(false, true);

        AiBlurResultOutcome outcome = service.apply(passMessage());

        assertThat(outcome).isEqualTo(AiBlurResultOutcome.OBJECT_NOT_FOUND);
        assertThat(pin.getVideoStatus()).isEqualTo(VideoStatus.PENDING);
        assertThat(pin.getBlurredVideoKey()).isNull();
        assertThat(job.getStatus()).isEqualTo(AiBlurJobStatus.PENDING);
        assertThat(job.getCompletedAt()).isNull();
    }

    @Test
    void PASS_썸네일_객체가_없으면_DB를_변경하지_않는다() {
        AiBlurJob job = job(AiBlurJobType.INITIAL_UPLOAD, AiBlurJobStatus.PENDING, DB_PIN_ID);
        Pin pin = pendingPin();
        given(aiBlurJobRepository.findById(REQUEST_ID)).willReturn(Optional.of(job));
        given(pinRepository.findById(DB_PIN_ID)).willReturn(Optional.of(pin));
        objectsExist(true, false);

        AiBlurResultOutcome outcome = service.apply(passMessage());

        assertThat(outcome).isEqualTo(AiBlurResultOutcome.OBJECT_NOT_FOUND);
        assertThat(pin.getVideoStatus()).isEqualTo(VideoStatus.PENDING);
        assertThat(pin.getThumbnailKey()).isNull();
        assertThat(job.getStatus()).isEqualTo(AiBlurJobStatus.PENDING);
    }

    // ---------- FAIL ----------

    @Test
    void FAIL_결과는_REJECTED로_반영하고_영상키를_저장하지_않는다() {
        AiBlurJob job = job(AiBlurJobType.INITIAL_UPLOAD, AiBlurJobStatus.PENDING, DB_PIN_ID);
        Pin pin = pendingPin();
        given(aiBlurJobRepository.findById(REQUEST_ID)).willReturn(Optional.of(job));
        given(pinRepository.findById(DB_PIN_ID)).willReturn(Optional.of(pin));

        AiBlurResultOutcome outcome = service.apply(failMessage());

        assertThat(outcome).isEqualTo(AiBlurResultOutcome.APPLIED);
        assertThat(pin.getVideoStatus()).isEqualTo(VideoStatus.REJECTED);
        assertThat(pin.getBlurredVideoKey()).isNull();
        assertThat(pin.getThumbnailKey()).isNull();
        assertThat(job.getStatus()).isEqualTo(AiBlurJobStatus.COMPLETED);
        assertThat(job.getCompletedAt()).isEqualTo(COMPLETED_AT);
        verify(s3ObjectInspector, never()).findObjectMetadata(any());
    }

    // ---------- FAILED ----------

    @Test
    void FAILED_결과는_Pin과_작업을_모두_FAILED로_반영한다() {
        AiBlurJob job = job(AiBlurJobType.INITIAL_UPLOAD, AiBlurJobStatus.PENDING, DB_PIN_ID);
        Pin pin = pendingPin();
        given(aiBlurJobRepository.findById(REQUEST_ID)).willReturn(Optional.of(job));
        given(pinRepository.findById(DB_PIN_ID)).willReturn(Optional.of(pin));

        AiBlurResultOutcome outcome = service.apply(failedMessage());

        assertThat(outcome).isEqualTo(AiBlurResultOutcome.APPLIED);
        assertThat(pin.getVideoStatus()).isEqualTo(VideoStatus.FAILED);
        assertThat(job.getStatus()).isEqualTo(AiBlurJobStatus.FAILED);
        assertThat(job.getCompletedAt()).isEqualTo(COMPLETED_AT);
        verify(s3ObjectInspector, never()).findObjectMetadata(any());
    }

    // ---------- 멱등 / 중복 / 충돌 ----------

    @Test
    void 이미_COMPLETED인_작업의_같은_결과는_중복으로_처리한다() {
        AiBlurJob job = job(AiBlurJobType.INITIAL_UPLOAD, AiBlurJobStatus.COMPLETED, DB_PIN_ID);
        given(aiBlurJobRepository.findById(REQUEST_ID)).willReturn(Optional.of(job));

        AiBlurResultOutcome outcome = service.apply(passMessage());

        assertThat(outcome).isEqualTo(AiBlurResultOutcome.DUPLICATE);
        assertThat(job.getStatus()).isEqualTo(AiBlurJobStatus.COMPLETED);
        verify(pinRepository, never()).findById(any());
        verify(s3ObjectInspector, never()).findObjectMetadata(any());
    }

    @Test
    void 이미_FAILED인_작업의_같은_결과는_중복으로_처리한다() {
        AiBlurJob job = job(AiBlurJobType.INITIAL_UPLOAD, AiBlurJobStatus.FAILED, DB_PIN_ID);
        given(aiBlurJobRepository.findById(REQUEST_ID)).willReturn(Optional.of(job));

        AiBlurResultOutcome outcome = service.apply(failedMessage());

        assertThat(outcome).isEqualTo(AiBlurResultOutcome.DUPLICATE);
        assertThat(job.getStatus()).isEqualTo(AiBlurJobStatus.FAILED);
        verify(pinRepository, never()).findById(any());
    }

    @Test
    void 이미_최종_상태인_작업에_다른_결과가_오면_충돌로_처리하고_기존_상태를_유지한다() {
        // 기존 COMPLETED 작업에 시스템 실패(FAILED) 결과가 도착
        AiBlurJob job = job(AiBlurJobType.INITIAL_UPLOAD, AiBlurJobStatus.COMPLETED, DB_PIN_ID);
        given(aiBlurJobRepository.findById(REQUEST_ID)).willReturn(Optional.of(job));

        AiBlurResultOutcome outcome = service.apply(failedMessage());

        assertThat(outcome).isEqualTo(AiBlurResultOutcome.CONFLICT);
        assertThat(job.getStatus()).isEqualTo(AiBlurJobStatus.COMPLETED);
        verify(pinRepository, never()).findById(any());
    }

    // ---------- 조회 실패 / 작업 유형 ----------

    @Test
    void 존재하지_않는_requestId면_JOB_NOT_FOUND를_반환한다() {
        given(aiBlurJobRepository.findById(REQUEST_ID)).willReturn(Optional.empty());

        AiBlurResultOutcome outcome = service.apply(passMessage());

        assertThat(outcome).isEqualTo(AiBlurResultOutcome.JOB_NOT_FOUND);
        verify(pinRepository, never()).findById(any());
    }

    @Test
    void INITIAL_UPLOAD_작업은_정상적으로_반영한다() {
        AiBlurJob job = job(AiBlurJobType.INITIAL_UPLOAD, AiBlurJobStatus.PENDING, DB_PIN_ID);
        Pin pin = pendingPin();
        given(aiBlurJobRepository.findById(REQUEST_ID)).willReturn(Optional.of(job));
        given(pinRepository.findById(DB_PIN_ID)).willReturn(Optional.of(pin));
        objectsExist(true, true);

        AiBlurResultOutcome outcome = service.apply(passMessage());

        assertThat(outcome).isEqualTo(AiBlurResultOutcome.APPLIED);
        assertThat(pin.getVideoStatus()).isEqualTo(VideoStatus.ACTIVE);
    }

    @Test
    void VIDEO_REPLACEMENT_작업은_Pin을_변경하지_않고_처리_불가를_반환한다() {
        AiBlurJob job = job(AiBlurJobType.VIDEO_REPLACEMENT, AiBlurJobStatus.PENDING, DB_PIN_ID);
        given(aiBlurJobRepository.findById(REQUEST_ID)).willReturn(Optional.of(job));

        AiBlurResultOutcome outcome = service.apply(passMessage());

        assertThat(outcome).isEqualTo(AiBlurResultOutcome.UNSUPPORTED_JOB_TYPE);
        assertThat(job.getStatus()).isEqualTo(AiBlurJobStatus.PENDING);
        verify(pinRepository, never()).findById(any());
        verify(s3ObjectInspector, never()).findObjectMetadata(any());
    }

    // ---------- pinId 출처 ----------

    @Test
    void 메시지_pinId가_달라도_작업의_pinId로_Pin을_조회한다() {
        AiBlurJob job = job(AiBlurJobType.INITIAL_UPLOAD, AiBlurJobStatus.PENDING, DB_PIN_ID);
        Pin pin = pendingPin();
        given(aiBlurJobRepository.findById(REQUEST_ID)).willReturn(Optional.of(job));
        given(pinRepository.findById(DB_PIN_ID)).willReturn(Optional.of(pin));

        // 메시지 pinId(MSG_PIN_ID)는 DB_PIN_ID와 다르다.
        AiBlurResultOutcome outcome = service.apply(failMessage());

        assertThat(outcome).isEqualTo(AiBlurResultOutcome.APPLIED);
        verify(pinRepository).findById(DB_PIN_ID);
        verify(pinRepository, never()).findById(MSG_PIN_ID);
    }

    // ---------- 트랜잭션 롤백(예외 전파) ----------

    @Test
    void 처리_중_예외가_발생하면_예외를_전파하고_엔티티를_변경하지_않는다() {
        AiBlurJob job = job(AiBlurJobType.INITIAL_UPLOAD, AiBlurJobStatus.PENDING, DB_PIN_ID);
        Pin pin = pendingPin();
        given(aiBlurJobRepository.findById(REQUEST_ID)).willReturn(Optional.of(job));
        given(pinRepository.findById(DB_PIN_ID)).willReturn(Optional.of(pin));
        // S3 확인 도중 예기치 못한 오류 → @Transactional에 의해 롤백되어야 한다.
        given(s3ObjectInspector.findObjectMetadata(BLURRED_KEY))
                .willThrow(new RuntimeException("S3 오류"));

        assertThatThrownBy(() -> service.apply(passMessage()))
                .isInstanceOf(RuntimeException.class);

        assertThat(pin.getVideoStatus()).isEqualTo(VideoStatus.PENDING);
        assertThat(pin.getBlurredVideoKey()).isNull();
        assertThat(job.getStatus()).isEqualTo(AiBlurJobStatus.PENDING);
        assertThat(job.getCompletedAt()).isNull();
    }
}
