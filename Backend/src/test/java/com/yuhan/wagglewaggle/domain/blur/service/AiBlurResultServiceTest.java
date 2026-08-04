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

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
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
 * AI 블러 결과 상태 반영 서비스 단위 테스트(최초 등록·영상 교체).
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class AiBlurResultServiceTest {

    @Mock private AiBlurJobRepository aiBlurJobRepository;
    @Mock private PinRepository pinRepository;
    @Mock private S3ObjectInspector s3ObjectInspector;
    @Mock private VideoObjectCleanupPort videoObjectCleanupPort;

    private AiBlurResultService service;

    private static final UUID REQUEST_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID OTHER_REQUEST_ID = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final UUID DB_PIN_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private static final UUID MSG_PIN_ID = UUID.fromString("99999999-9999-9999-9999-999999999999");
    private static final Long PLACE_ID = 1L;

    private static final Instant COMPLETED_AT = Instant.parse("2026-07-31T12:00:00Z");
    // 결과 반영 서버 시각(Clock 고정). 메시지 시각과 달라 expiresAt 기준을 구분해 검증한다.
    private static final Instant SERVER_NOW = Instant.parse("2026-08-02T00:00:00Z");

    private static final String ORIGINAL_KEY = "pins/original/42/33333333-3333-3333-3333-333333333333.mp4";
    private static final String BLURRED_KEY = "pins/blurred/42/44444444-4444-4444-4444-444444444444.mp4";
    private static final String THUMBNAIL_KEY = "pins/thumbnail/42/55555555-5555-5555-5555-555555555555.jpg";

    // 영상 교체: Pin의 기존 공개 키와, 교체 작업의 새 후보 원본 키.
    private static final String OLD_ORIGINAL_KEY = "pins/original/42/old-original.mp4";
    private static final String OLD_BLURRED_KEY = "pins/blurred/42/old-blurred.mp4";
    private static final String OLD_THUMBNAIL_KEY = "pins/thumbnail/42/old-thumb.jpg";
    private static final String NEW_ORIGINAL_KEY = "pins/original/42/66666666-6666-6666-6666-666666666666.mp4";

    private static final GeometryFactory GF = new GeometryFactory(new PrecisionModel(), 4326);

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(SERVER_NOW, ZoneOffset.UTC);
        service = new AiBlurResultService(
                new AiBlurResultMessageValidator(), aiBlurJobRepository, pinRepository, s3ObjectInspector,
                videoObjectCleanupPort, clock);
    }

    // ---------- 헬퍼 ----------

    private AiBlurJob job(AiBlurJobType jobType, AiBlurJobStatus status, UUID pinId) {
        AiBlurJob job = AiBlurJob.create(pinId, ORIGINAL_KEY, jobType);
        ReflectionTestUtils.setField(job, "requestId", REQUEST_ID);
        ReflectionTestUtils.setField(job, "status", status);
        return job;
    }

    private AiBlurJob replacementJob(AiBlurJobStatus status) {
        AiBlurJob job = AiBlurJob.create(DB_PIN_ID, NEW_ORIGINAL_KEY, AiBlurJobType.VIDEO_REPLACEMENT);
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

    /** 기존 공개 영상을 가진 ACTIVE 핀(영상 교체 대상). */
    private Pin activePin() {
        Place place = Place.create("kakao-1", "장소", GF.createPoint(new Coordinate(127.0, 37.5)));
        ReflectionTestUtils.setField(place, "id", PLACE_ID);
        Pin pin = Pin.create(
                org.mockito.Mockito.mock(Member.class), place, CrowdLevel.WAGLE,
                GF.createPoint(new Coordinate(127.0, 37.5)),
                "2층 창가", "메모", OLD_ORIGINAL_KEY, Instant.parse("2026-07-31T13:00:00Z"));
        ReflectionTestUtils.setField(pin, "id", DB_PIN_ID);
        ReflectionTestUtils.setField(pin, "videoStatus", VideoStatus.ACTIVE);
        ReflectionTestUtils.setField(pin, "blurredVideoKey", OLD_BLURRED_KEY);
        ReflectionTestUtils.setField(pin, "thumbnailKey", OLD_THUMBNAIL_KEY);
        return pin;
    }

    /** 현재 작업(REQUEST_ID)이 이 Pin의 최신 영상 교체 작업이라고 스텁한다. */
    private void givenCurrentIsLatestReplacement(AiBlurJob job) {
        given(aiBlurJobRepository.findFirstByPinIdAndJobTypeOrderByCreatedAtDesc(
                DB_PIN_ID, AiBlurJobType.VIDEO_REPLACEMENT)).willReturn(Optional.of(job));
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

    // ========================= INITIAL_UPLOAD (회귀) =========================

    @Test
    void INITIAL_PASS_영상과_썸네일이_존재하면_ACTIVE로_반영한다() {
        AiBlurJob job = job(AiBlurJobType.INITIAL_UPLOAD, AiBlurJobStatus.PENDING, DB_PIN_ID);
        Pin pin = pendingPin();
        given(aiBlurJobRepository.findById(REQUEST_ID)).willReturn(Optional.of(job));
        given(pinRepository.findByIdForUpdate(DB_PIN_ID)).willReturn(Optional.of(pin));
        objectsExist(true, true);

        AiBlurResultOutcome outcome = service.apply(passMessage());

        assertThat(outcome).isEqualTo(AiBlurResultOutcome.APPLIED);
        assertThat(pin.getVideoStatus()).isEqualTo(VideoStatus.ACTIVE);
        assertThat(pin.getBlurredVideoKey()).isEqualTo(BLURRED_KEY);
        assertThat(pin.getThumbnailKey()).isEqualTo(THUMBNAIL_KEY);
        // expiresAt은 메시지 completedAt이 아니라 반영 서버 시각(SERVER_NOW) 기준 1시간 뒤다.
        assertThat(pin.getExpiresAt()).isEqualTo(SERVER_NOW.plusSeconds(3600));
        assertThat(job.getStatus()).isEqualTo(AiBlurJobStatus.COMPLETED);
        assertThat(job.getFinalStatus()).isEqualTo(FinalStatus.PASS);
        assertThat(job.getCompletedAt()).isEqualTo(COMPLETED_AT);
        // 최초 등록은 삭제 대상 등록을 하지 않는다.
        verify(videoObjectCleanupPort, never()).registerForDeletion(any());
    }

    @Test
    void INITIAL_PASS_영상_객체가_없으면_DB를_변경하지_않는다() {
        AiBlurJob job = job(AiBlurJobType.INITIAL_UPLOAD, AiBlurJobStatus.PENDING, DB_PIN_ID);
        Pin pin = pendingPin();
        given(aiBlurJobRepository.findById(REQUEST_ID)).willReturn(Optional.of(job));
        given(pinRepository.findByIdForUpdate(DB_PIN_ID)).willReturn(Optional.of(pin));
        objectsExist(false, true);

        AiBlurResultOutcome outcome = service.apply(passMessage());

        assertThat(outcome).isEqualTo(AiBlurResultOutcome.OBJECT_NOT_FOUND);
        assertThat(pin.getVideoStatus()).isEqualTo(VideoStatus.PENDING);
        assertThat(job.getStatus()).isEqualTo(AiBlurJobStatus.PENDING);
    }

    @Test
    void INITIAL_FAIL_결과는_REJECTED로_반영한다() {
        AiBlurJob job = job(AiBlurJobType.INITIAL_UPLOAD, AiBlurJobStatus.PENDING, DB_PIN_ID);
        Pin pin = pendingPin();
        given(aiBlurJobRepository.findById(REQUEST_ID)).willReturn(Optional.of(job));
        given(pinRepository.findByIdForUpdate(DB_PIN_ID)).willReturn(Optional.of(pin));

        AiBlurResultOutcome outcome = service.apply(failMessage());

        assertThat(outcome).isEqualTo(AiBlurResultOutcome.APPLIED);
        assertThat(pin.getVideoStatus()).isEqualTo(VideoStatus.REJECTED);
        assertThat(job.getStatus()).isEqualTo(AiBlurJobStatus.COMPLETED);
        assertThat(job.getFinalStatus()).isEqualTo(FinalStatus.FAIL);
        verify(s3ObjectInspector, never()).findObjectMetadata(any());
    }

    @Test
    void INITIAL_FAILED_결과는_Pin과_작업을_모두_FAILED로_반영한다() {
        AiBlurJob job = job(AiBlurJobType.INITIAL_UPLOAD, AiBlurJobStatus.PENDING, DB_PIN_ID);
        Pin pin = pendingPin();
        given(aiBlurJobRepository.findById(REQUEST_ID)).willReturn(Optional.of(job));
        given(pinRepository.findByIdForUpdate(DB_PIN_ID)).willReturn(Optional.of(pin));

        AiBlurResultOutcome outcome = service.apply(failedMessage());

        assertThat(outcome).isEqualTo(AiBlurResultOutcome.APPLIED);
        assertThat(pin.getVideoStatus()).isEqualTo(VideoStatus.FAILED);
        assertThat(job.getStatus()).isEqualTo(AiBlurJobStatus.FAILED);
    }

    // ========================= 삭제된 핀: 결과 미반영 =========================

    @Test
    void INITIAL_PASS_삭제된_Pin이면_반영하지_않고_작업만_COMPLETED로_종료한다() {
        AiBlurJob job = job(AiBlurJobType.INITIAL_UPLOAD, AiBlurJobStatus.PENDING, DB_PIN_ID);
        Pin pin = pendingPin();
        ReflectionTestUtils.setField(pin, "deletedAt", Instant.parse("2026-08-01T00:00:00Z"));
        given(aiBlurJobRepository.findById(REQUEST_ID)).willReturn(Optional.of(job));
        given(pinRepository.findByIdForUpdate(DB_PIN_ID)).willReturn(Optional.of(pin));

        AiBlurResultOutcome outcome = service.apply(passMessage());

        assertThat(outcome).isEqualTo(AiBlurResultOutcome.PIN_DELETED_SKIPPED);
        // 핀 영상 키·video_status 미변경
        assertThat(pin.getVideoStatus()).isEqualTo(VideoStatus.PENDING);
        assertThat(pin.getBlurredVideoKey()).isNull();
        assertThat(pin.getThumbnailKey()).isNull();
        // 작업만 종료, 후보 원본·미적용 결과 객체는 삭제 대상 등록
        assertThat(job.getStatus()).isEqualTo(AiBlurJobStatus.COMPLETED);
        assertThat(job.getCompletedAt()).isEqualTo(COMPLETED_AT);
        verify(videoObjectCleanupPort).registerForDeletion(ORIGINAL_KEY);
        verify(videoObjectCleanupPort).registerForDeletion(BLURRED_KEY);
        verify(videoObjectCleanupPort).registerForDeletion(THUMBNAIL_KEY);
        // 삭제된 핀은 결과 객체 존재 확인 이전에 단락된다
        verify(s3ObjectInspector, never()).findObjectMetadata(any());
    }

    @Test
    void INITIAL_FAILED_삭제된_Pin이면_반영하지_않고_작업만_FAILED로_종료한다() {
        AiBlurJob job = job(AiBlurJobType.INITIAL_UPLOAD, AiBlurJobStatus.PENDING, DB_PIN_ID);
        Pin pin = pendingPin();
        ReflectionTestUtils.setField(pin, "deletedAt", Instant.parse("2026-08-01T00:00:00Z"));
        given(aiBlurJobRepository.findById(REQUEST_ID)).willReturn(Optional.of(job));
        given(pinRepository.findByIdForUpdate(DB_PIN_ID)).willReturn(Optional.of(pin));

        AiBlurResultOutcome outcome = service.apply(failedMessage());

        assertThat(outcome).isEqualTo(AiBlurResultOutcome.PIN_DELETED_SKIPPED);
        assertThat(pin.getVideoStatus()).isEqualTo(VideoStatus.PENDING);
        assertThat(job.getStatus()).isEqualTo(AiBlurJobStatus.FAILED);
        assertThat(job.getCompletedAt()).isEqualTo(COMPLETED_AT);
        verify(videoObjectCleanupPort).registerForDeletion(ORIGINAL_KEY);
    }

    // ========================= 멱등 / 중복 / 충돌 =========================

    @Test
    void 이미_PASS로_COMPLETED된_작업에_같은_PASS가_오면_중복으로_처리한다() {
        AiBlurJob job = job(AiBlurJobType.INITIAL_UPLOAD, AiBlurJobStatus.COMPLETED, DB_PIN_ID);
        ReflectionTestUtils.setField(job, "finalStatus", FinalStatus.PASS);
        given(aiBlurJobRepository.findById(REQUEST_ID)).willReturn(Optional.of(job));

        AiBlurResultOutcome outcome = service.apply(passMessage());

        assertThat(outcome).isEqualTo(AiBlurResultOutcome.DUPLICATE);
        verify(pinRepository, never()).findByIdForUpdate(any());
    }

    @Test
    void 이미_PASS로_COMPLETED된_작업에_FAIL이_오면_충돌로_처리한다() {
        // 회귀 방지: PASS와 FAIL 모두 processingStatus=COMPLETED라 예전에는 중복으로 오판했다.
        AiBlurJob job = job(AiBlurJobType.INITIAL_UPLOAD, AiBlurJobStatus.COMPLETED, DB_PIN_ID);
        ReflectionTestUtils.setField(job, "finalStatus", FinalStatus.PASS);
        given(aiBlurJobRepository.findById(REQUEST_ID)).willReturn(Optional.of(job));

        AiBlurResultOutcome outcome = service.apply(failMessage());

        assertThat(outcome).isEqualTo(AiBlurResultOutcome.CONFLICT);
        assertThat(job.getStatus()).isEqualTo(AiBlurJobStatus.COMPLETED);
        assertThat(job.getFinalStatus()).isEqualTo(FinalStatus.PASS);
        verify(pinRepository, never()).findByIdForUpdate(any());
    }

    @Test
    void 레거시_finalStatus가_없는_COMPLETED_작업은_기존처럼_중복으로_처리한다() {
        // final_status 미기록(legacy) COMPLETED 행: PASS/FAIL 구분 불가 → 완화된 중복 처리 유지.
        AiBlurJob job = job(AiBlurJobType.INITIAL_UPLOAD, AiBlurJobStatus.COMPLETED, DB_PIN_ID);
        given(aiBlurJobRepository.findById(REQUEST_ID)).willReturn(Optional.of(job));

        assertThat(service.apply(passMessage())).isEqualTo(AiBlurResultOutcome.DUPLICATE);
        assertThat(service.apply(failMessage())).isEqualTo(AiBlurResultOutcome.DUPLICATE);
    }

    @Test
    void 이미_COMPLETED인_교체_작업의_같은_결과도_중복으로_처리한다() {
        AiBlurJob job = replacementJob(AiBlurJobStatus.COMPLETED);
        ReflectionTestUtils.setField(job, "finalStatus", FinalStatus.PASS);
        given(aiBlurJobRepository.findById(REQUEST_ID)).willReturn(Optional.of(job));

        AiBlurResultOutcome outcome = service.apply(passMessage());

        assertThat(outcome).isEqualTo(AiBlurResultOutcome.DUPLICATE);
        verify(pinRepository, never()).findByIdForUpdate(any());
        verify(videoObjectCleanupPort, never()).registerForDeletion(any());
    }

    @Test
    void 이미_최종_상태인_작업에_시스템_FAILED가_오면_충돌로_처리한다() {
        AiBlurJob job = job(AiBlurJobType.INITIAL_UPLOAD, AiBlurJobStatus.COMPLETED, DB_PIN_ID);
        ReflectionTestUtils.setField(job, "finalStatus", FinalStatus.PASS);
        given(aiBlurJobRepository.findById(REQUEST_ID)).willReturn(Optional.of(job));

        AiBlurResultOutcome outcome = service.apply(failedMessage());

        assertThat(outcome).isEqualTo(AiBlurResultOutcome.CONFLICT);
        assertThat(job.getStatus()).isEqualTo(AiBlurJobStatus.COMPLETED);
    }

    @Test
    void 존재하지_않는_requestId면_JOB_NOT_FOUND를_반환한다() {
        given(aiBlurJobRepository.findById(REQUEST_ID)).willReturn(Optional.empty());

        assertThat(service.apply(passMessage())).isEqualTo(AiBlurResultOutcome.JOB_NOT_FOUND);
    }

    // ========================= VIDEO_REPLACEMENT: PASS =========================

    @Test
    void 교체_PASS_최신_ACTIVE면_기존_영상을_새_결과로_원자적_교체한다() {
        AiBlurJob job = replacementJob(AiBlurJobStatus.PENDING);
        Pin pin = activePin();
        given(aiBlurJobRepository.findById(REQUEST_ID)).willReturn(Optional.of(job));
        given(pinRepository.findByIdForUpdate(DB_PIN_ID)).willReturn(Optional.of(pin));
        givenCurrentIsLatestReplacement(job);
        objectsExist(true, true);

        AiBlurResultOutcome outcome = service.apply(passMessage());

        assertThat(outcome).isEqualTo(AiBlurResultOutcome.APPLIED);
        // 기존 공개(ACTIVE) 유지, 새 키로 교체
        assertThat(pin.getVideoStatus()).isEqualTo(VideoStatus.ACTIVE);
        assertThat(pin.getOriginalVideoKey()).isEqualTo(NEW_ORIGINAL_KEY);
        assertThat(pin.getBlurredVideoKey()).isEqualTo(BLURRED_KEY);
        assertThat(pin.getThumbnailKey()).isEqualTo(THUMBNAIL_KEY);
        // expiresAt은 메시지 시각이 아니라 반영 서버 시각(SERVER_NOW) 기준 1시간 뒤
        assertThat(pin.getExpiresAt()).isEqualTo(SERVER_NOW.plusSeconds(3600));
        assertThat(job.getStatus()).isEqualTo(AiBlurJobStatus.COMPLETED);
        assertThat(job.getCompletedAt()).isEqualTo(COMPLETED_AT);
    }

    @Test
    void 교체_PASS_반영_시_기존_객체를_삭제_대상으로_등록한다() {
        AiBlurJob job = replacementJob(AiBlurJobStatus.PENDING);
        Pin pin = activePin();
        given(aiBlurJobRepository.findById(REQUEST_ID)).willReturn(Optional.of(job));
        given(pinRepository.findByIdForUpdate(DB_PIN_ID)).willReturn(Optional.of(pin));
        givenCurrentIsLatestReplacement(job);
        objectsExist(true, true);

        service.apply(passMessage());

        verify(videoObjectCleanupPort).registerForDeletion(OLD_ORIGINAL_KEY);
        verify(videoObjectCleanupPort).registerForDeletion(OLD_BLURRED_KEY);
        verify(videoObjectCleanupPort).registerForDeletion(OLD_THUMBNAIL_KEY);
    }

    @Test
    void 교체_PASS_기존_expiresAt이_지났어도_최신이면_반영한다() {
        AiBlurJob job = replacementJob(AiBlurJobStatus.PENDING);
        Pin pin = activePin();
        // 기존 만료 시각을 과거로 만든다(요청 당시엔 미만료였고 AI 처리 중 만료된 상황).
        ReflectionTestUtils.setField(pin, "expiresAt", Instant.parse("2026-08-01T00:00:00Z"));
        given(aiBlurJobRepository.findById(REQUEST_ID)).willReturn(Optional.of(job));
        given(pinRepository.findByIdForUpdate(DB_PIN_ID)).willReturn(Optional.of(pin));
        givenCurrentIsLatestReplacement(job);
        objectsExist(true, true);

        AiBlurResultOutcome outcome = service.apply(passMessage());

        assertThat(outcome).isEqualTo(AiBlurResultOutcome.APPLIED);
        assertThat(pin.getBlurredVideoKey()).isEqualTo(BLURRED_KEY);
        assertThat(pin.getExpiresAt()).isEqualTo(SERVER_NOW.plusSeconds(3600));
    }

    @Test
    void 교체_PASS_결과_객체가_없으면_DB를_변경하지_않는다() {
        AiBlurJob job = replacementJob(AiBlurJobStatus.PENDING);
        Pin pin = activePin();
        given(aiBlurJobRepository.findById(REQUEST_ID)).willReturn(Optional.of(job));
        given(pinRepository.findByIdForUpdate(DB_PIN_ID)).willReturn(Optional.of(pin));
        givenCurrentIsLatestReplacement(job);
        objectsExist(false, true);

        AiBlurResultOutcome outcome = service.apply(passMessage());

        assertThat(outcome).isEqualTo(AiBlurResultOutcome.OBJECT_NOT_FOUND);
        assertThat(pin.getOriginalVideoKey()).isEqualTo(OLD_ORIGINAL_KEY);
        assertThat(pin.getBlurredVideoKey()).isEqualTo(OLD_BLURRED_KEY);
        assertThat(job.getStatus()).isEqualTo(AiBlurJobStatus.PENDING);
        verify(videoObjectCleanupPort, never()).registerForDeletion(any());
    }

    // ========================= VIDEO_REPLACEMENT: 반영 불가 PASS =========================

    @Test
    void 교체_PASS_최신_작업이_아니면_반영하지_않고_COMPLETED로_종료한다() {
        AiBlurJob job = replacementJob(AiBlurJobStatus.PENDING);
        Pin pin = activePin();
        given(aiBlurJobRepository.findById(REQUEST_ID)).willReturn(Optional.of(job));
        given(pinRepository.findByIdForUpdate(DB_PIN_ID)).willReturn(Optional.of(pin));
        // 최신 교체 작업은 다른(더 최근) requestId
        AiBlurJob newer = replacementJob(AiBlurJobStatus.PENDING);
        ReflectionTestUtils.setField(newer, "requestId", OTHER_REQUEST_ID);
        given(aiBlurJobRepository.findFirstByPinIdAndJobTypeOrderByCreatedAtDesc(
                DB_PIN_ID, AiBlurJobType.VIDEO_REPLACEMENT)).willReturn(Optional.of(newer));

        AiBlurResultOutcome outcome = service.apply(passMessage());

        assertThat(outcome).isEqualTo(AiBlurResultOutcome.REPLACEMENT_SKIPPED);
        // Pin 미변경, 작업만 종료
        assertThat(pin.getOriginalVideoKey()).isEqualTo(OLD_ORIGINAL_KEY);
        assertThat(pin.getVideoStatus()).isEqualTo(VideoStatus.ACTIVE);
        assertThat(job.getStatus()).isEqualTo(AiBlurJobStatus.COMPLETED);
        // 후보 원본·결과 객체는 삭제 대상 등록
        verify(videoObjectCleanupPort).registerForDeletion(NEW_ORIGINAL_KEY);
        verify(s3ObjectInspector, never()).findObjectMetadata(any());
    }

    @Test
    void 교체_PASS_삭제된_Pin이면_반영하지_않고_종료한다() {
        AiBlurJob job = replacementJob(AiBlurJobStatus.PENDING);
        Pin pin = activePin();
        ReflectionTestUtils.setField(pin, "deletedAt", Instant.parse("2026-08-01T00:00:00Z"));
        given(aiBlurJobRepository.findById(REQUEST_ID)).willReturn(Optional.of(job));
        given(pinRepository.findByIdForUpdate(DB_PIN_ID)).willReturn(Optional.of(pin));

        AiBlurResultOutcome outcome = service.apply(passMessage());

        // 삭제된 핀은 최신 교체 판정 이전에 단락되어 PIN_DELETED_SKIPPED로 종료한다.
        assertThat(outcome).isEqualTo(AiBlurResultOutcome.PIN_DELETED_SKIPPED);
        assertThat(pin.getOriginalVideoKey()).isEqualTo(OLD_ORIGINAL_KEY);
        assertThat(job.getStatus()).isEqualTo(AiBlurJobStatus.COMPLETED);
        verify(videoObjectCleanupPort).registerForDeletion(NEW_ORIGINAL_KEY);
    }

    @Test
    void 교체_PASS_ACTIVE가_아니면_반영하지_않고_종료한다() {
        AiBlurJob job = replacementJob(AiBlurJobStatus.PENDING);
        Pin pin = activePin();
        ReflectionTestUtils.setField(pin, "videoStatus", VideoStatus.REJECTED);
        given(aiBlurJobRepository.findById(REQUEST_ID)).willReturn(Optional.of(job));
        given(pinRepository.findByIdForUpdate(DB_PIN_ID)).willReturn(Optional.of(pin));
        givenCurrentIsLatestReplacement(job);

        AiBlurResultOutcome outcome = service.apply(passMessage());

        assertThat(outcome).isEqualTo(AiBlurResultOutcome.REPLACEMENT_SKIPPED);
        assertThat(pin.getVideoStatus()).isEqualTo(VideoStatus.REJECTED);
        assertThat(job.getStatus()).isEqualTo(AiBlurJobStatus.COMPLETED);
    }

    // ========================= VIDEO_REPLACEMENT: FAIL / FAILED =========================

    @Test
    void 교체_FAIL이면_기존_영상을_유지하고_작업만_COMPLETED로_종료한다() {
        AiBlurJob job = replacementJob(AiBlurJobStatus.PENDING);
        Pin pin = activePin();
        given(aiBlurJobRepository.findById(REQUEST_ID)).willReturn(Optional.of(job));
        given(pinRepository.findByIdForUpdate(DB_PIN_ID)).willReturn(Optional.of(pin));

        AiBlurResultOutcome outcome = service.apply(failMessage());

        assertThat(outcome).isEqualTo(AiBlurResultOutcome.APPLIED);
        // 기존 영상·상태 유지(REJECTED로 바뀌지 않음)
        assertThat(pin.getVideoStatus()).isEqualTo(VideoStatus.ACTIVE);
        assertThat(pin.getOriginalVideoKey()).isEqualTo(OLD_ORIGINAL_KEY);
        assertThat(pin.getBlurredVideoKey()).isEqualTo(OLD_BLURRED_KEY);
        assertThat(pin.getThumbnailKey()).isEqualTo(OLD_THUMBNAIL_KEY);
        assertThat(job.getStatus()).isEqualTo(AiBlurJobStatus.COMPLETED);
        // 후보 원본은 삭제 대상 등록
        verify(videoObjectCleanupPort).registerForDeletion(NEW_ORIGINAL_KEY);
    }

    @Test
    void 교체_FAILED이면_기존_영상을_유지하고_작업만_FAILED로_종료한다() {
        AiBlurJob job = replacementJob(AiBlurJobStatus.PENDING);
        Pin pin = activePin();
        given(aiBlurJobRepository.findById(REQUEST_ID)).willReturn(Optional.of(job));
        given(pinRepository.findByIdForUpdate(DB_PIN_ID)).willReturn(Optional.of(pin));

        AiBlurResultOutcome outcome = service.apply(failedMessage());

        assertThat(outcome).isEqualTo(AiBlurResultOutcome.APPLIED);
        assertThat(pin.getVideoStatus()).isEqualTo(VideoStatus.ACTIVE);
        assertThat(pin.getOriginalVideoKey()).isEqualTo(OLD_ORIGINAL_KEY);
        assertThat(pin.getExpiresAt()).isEqualTo(Instant.parse("2026-07-31T13:00:00Z"));
        assertThat(job.getStatus()).isEqualTo(AiBlurJobStatus.FAILED);
        verify(videoObjectCleanupPort).registerForDeletion(NEW_ORIGINAL_KEY);
    }

    // ========================= pinId 출처 =========================

    @Test
    void 메시지_pinId가_달라도_작업의_pinId로_Pin을_조회한다() {
        AiBlurJob job = replacementJob(AiBlurJobStatus.PENDING);
        Pin pin = activePin();
        given(aiBlurJobRepository.findById(REQUEST_ID)).willReturn(Optional.of(job));
        given(pinRepository.findByIdForUpdate(DB_PIN_ID)).willReturn(Optional.of(pin));

        // 메시지 pinId(MSG_PIN_ID)는 DB_PIN_ID와 다르다. FAIL은 반영 가능 여부와 무관하게 종료된다.
        service.apply(failMessage());

        verify(pinRepository).findByIdForUpdate(DB_PIN_ID);
        verify(pinRepository, never()).findByIdForUpdate(MSG_PIN_ID);
    }

    // ========================= 트랜잭션 롤백(예외 전파) =========================

    @Test
    void 처리_중_예외가_발생하면_예외를_전파하고_엔티티를_변경하지_않는다() {
        AiBlurJob job = job(AiBlurJobType.INITIAL_UPLOAD, AiBlurJobStatus.PENDING, DB_PIN_ID);
        Pin pin = pendingPin();
        given(aiBlurJobRepository.findById(REQUEST_ID)).willReturn(Optional.of(job));
        given(pinRepository.findByIdForUpdate(DB_PIN_ID)).willReturn(Optional.of(pin));
        given(s3ObjectInspector.findObjectMetadata(BLURRED_KEY))
                .willThrow(new RuntimeException("S3 오류"));

        assertThatThrownBy(() -> service.apply(passMessage()))
                .isInstanceOf(RuntimeException.class);

        assertThat(pin.getVideoStatus()).isEqualTo(VideoStatus.PENDING);
        assertThat(job.getStatus()).isEqualTo(AiBlurJobStatus.PENDING);
    }
}
