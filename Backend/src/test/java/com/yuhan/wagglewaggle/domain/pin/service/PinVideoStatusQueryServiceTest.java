package com.yuhan.wagglewaggle.domain.pin.service;

import com.yuhan.wagglewaggle.domain.pin.dto.PinVideoStatusView;
import com.yuhan.wagglewaggle.domain.pin.entity.CrowdLevel;
import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import com.yuhan.wagglewaggle.domain.pin.entity.VideoStatus;
import com.yuhan.wagglewaggle.domain.pin.repository.PinRepository;
import com.yuhan.wagglewaggle.domain.place.entity.Place;
import com.yuhan.wagglewaggle.domain.user.entity.AgeGroup;
import com.yuhan.wagglewaggle.domain.user.entity.Gender;
import com.yuhan.wagglewaggle.domain.user.entity.Member;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import com.yuhan.wagglewaggle.global.s3.S3PresignedUrlGenerator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.PrecisionModel;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataAccessException;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class PinVideoStatusQueryServiceTest {

    @Mock private PinRepository pinRepository;
    @Mock private S3PresignedUrlGenerator s3PresignedUrlGenerator;

    private PinVideoStatusQueryService service;

    private static final Long OWNER_ID = 42L;
    private static final Long OTHER_ID = 99L;
    private static final UUID PIN_ID = UUID.fromString("11111111-2222-3333-4444-555555555555");
    private static final String BLURRED_KEY = "pins/blurred/42/blurred.mp4";
    private static final String THUMBNAIL_KEY = "pins/thumbnail/42/thumb.jpg";
    private static final String VIDEO_URL = "https://bucket.s3/blurred?sig=video";
    private static final String THUMBNAIL_URL = "https://bucket.s3/thumb?sig=thumb";

    private static final GeometryFactory GF = new GeometryFactory(new PrecisionModel(), 4326);

    @BeforeEach
    void setUp() {
        service = new PinVideoStatusQueryService(pinRepository, s3PresignedUrlGenerator);
    }

    /** OWNER_ID 소유의, 지정한 상태·만료 시각·키를 가진 핀을 만든다. */
    private Pin pin(VideoStatus status, Instant expiresAt, String blurredKey, String thumbnailKey) {
        Member member = Member.create("owner", AgeGroup.TWENTIES, Gender.MALE);
        ReflectionTestUtils.setField(member, "id", OWNER_ID);

        Pin pin = Pin.create(
                member, mock(Place.class), CrowdLevel.WAGLE,
                GF.createPoint(new Coordinate(127.0, 37.5)),
                null, null, "pins/original/42/original.mp4", null);
        ReflectionTestUtils.setField(pin, "id", PIN_ID);
        ReflectionTestUtils.setField(pin, "videoStatus", status);
        ReflectionTestUtils.setField(pin, "expiresAt", expiresAt);
        ReflectionTestUtils.setField(pin, "blurredVideoKey", blurredKey);
        ReflectionTestUtils.setField(pin, "thumbnailKey", thumbnailKey);
        return pin;
    }

    private Pin pin(VideoStatus status) {
        return pin(status, null, null, null);
    }

    @Test
    void 핀이_없으면_PIN_NOT_FOUND() {
        given(pinRepository.findById(PIN_ID)).willReturn(Optional.empty());

        assertThatThrownBy(() -> service.getVideoStatus(OWNER_ID, PIN_ID))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.PIN_NOT_FOUND);
        verifyNoInteractions(s3PresignedUrlGenerator);
    }

    @Test
    void 게시자가_아니면_403_PIN_STATUS_READ_FORBIDDEN() {
        given(pinRepository.findById(PIN_ID)).willReturn(Optional.of(pin(VideoStatus.PENDING)));

        assertThatThrownBy(() -> service.getVideoStatus(OTHER_ID, PIN_ID))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.PIN_STATUS_READ_FORBIDDEN);
        verifyNoInteractions(s3PresignedUrlGenerator);
    }

    @Test
    void PENDING이면_URL_없이_상태와_메시지를_반환한다() {
        given(pinRepository.findById(PIN_ID)).willReturn(Optional.of(pin(VideoStatus.PENDING)));

        PinVideoStatusView view = service.getVideoStatus(OWNER_ID, PIN_ID);

        assertThat(view.message()).isEqualTo("영상 처리 상태를 조회했습니다.");
        assertThat(view.data().pinId()).isEqualTo(PIN_ID);
        assertThat(view.data().videoStatus()).isEqualTo(VideoStatus.PENDING);
        assertThat(view.data().videoUrl()).isNull();
        assertThat(view.data().thumbnailUrl()).isNull();
        verifyNoInteractions(s3PresignedUrlGenerator);
    }

    @Test
    void REJECTED이면_URL_없이_상태와_메시지를_반환한다() {
        given(pinRepository.findById(PIN_ID)).willReturn(Optional.of(pin(VideoStatus.REJECTED)));

        PinVideoStatusView view = service.getVideoStatus(OWNER_ID, PIN_ID);

        assertThat(view.message()).isEqualTo("영상이 검수 기준을 통과하지 못했습니다.");
        assertThat(view.data().videoStatus()).isEqualTo(VideoStatus.REJECTED);
        assertThat(view.data().videoUrl()).isNull();
        assertThat(view.data().thumbnailUrl()).isNull();
        verifyNoInteractions(s3PresignedUrlGenerator);
    }

    @Test
    void FAILED이면_URL_없이_상태와_메시지를_반환한다() {
        given(pinRepository.findById(PIN_ID)).willReturn(Optional.of(pin(VideoStatus.FAILED)));

        PinVideoStatusView view = service.getVideoStatus(OWNER_ID, PIN_ID);

        assertThat(view.message()).isEqualTo("영상 처리 중 오류가 발생했습니다.");
        assertThat(view.data().videoStatus()).isEqualTo(VideoStatus.FAILED);
        assertThat(view.data().videoUrl()).isNull();
        assertThat(view.data().thumbnailUrl()).isNull();
        verifyNoInteractions(s3PresignedUrlGenerator);
    }

    @Test
    void 만료되지_않은_ACTIVE이면_영상과_썸네일_URL을_함께_발급한다() {
        Instant future = Instant.now().plus(Duration.ofMinutes(30));
        given(pinRepository.findById(PIN_ID))
                .willReturn(Optional.of(pin(VideoStatus.ACTIVE, future, BLURRED_KEY, THUMBNAIL_KEY)));
        given(s3PresignedUrlGenerator.createDownloadUrl(BLURRED_KEY)).willReturn(VIDEO_URL);
        given(s3PresignedUrlGenerator.createDownloadUrl(THUMBNAIL_KEY)).willReturn(THUMBNAIL_URL);

        PinVideoStatusView view = service.getVideoStatus(OWNER_ID, PIN_ID);

        assertThat(view.message()).isEqualTo("영상 처리가 완료되었습니다.");
        assertThat(view.data().videoStatus()).isEqualTo(VideoStatus.ACTIVE);
        assertThat(view.data().videoUrl()).isEqualTo(VIDEO_URL);
        assertThat(view.data().thumbnailUrl()).isEqualTo(THUMBNAIL_URL);
        verify(s3PresignedUrlGenerator).createDownloadUrl(BLURRED_KEY);
        verify(s3PresignedUrlGenerator).createDownloadUrl(THUMBNAIL_KEY);
    }

    @Test
    void 만료된_ACTIVE이면_상태는_ACTIVE지만_URL은_발급하지_않는다() {
        Instant past = Instant.now().minus(Duration.ofMinutes(1));
        given(pinRepository.findById(PIN_ID))
                .willReturn(Optional.of(pin(VideoStatus.ACTIVE, past, BLURRED_KEY, THUMBNAIL_KEY)));

        PinVideoStatusView view = service.getVideoStatus(OWNER_ID, PIN_ID);

        assertThat(view.message()).isEqualTo("영상 처리가 완료되었습니다.");
        assertThat(view.data().videoStatus()).isEqualTo(VideoStatus.ACTIVE);
        assertThat(view.data().videoUrl()).isNull();
        assertThat(view.data().thumbnailUrl()).isNull();
        verifyNoInteractions(s3PresignedUrlGenerator);
    }

    @Test
    void 만료되지_않은_ACTIVE인데_thumbnailKey가_누락되면_PIN_STATUS_READ_FAILED로_처리한다() {
        Instant future = Instant.now().plus(Duration.ofMinutes(30));
        given(pinRepository.findById(PIN_ID))
                .willReturn(Optional.of(pin(VideoStatus.ACTIVE, future, BLURRED_KEY, null)));

        assertThatThrownBy(() -> service.getVideoStatus(OWNER_ID, PIN_ID))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.PIN_STATUS_READ_FAILED);
        // 부분 URL을 만들지 않도록 생성기를 호출하지 않는다.
        verify(s3PresignedUrlGenerator, never()).createDownloadUrl(anyString());
    }

    @Test
    void 만료되지_않은_ACTIVE인데_blurredVideoKey가_누락되면_PIN_STATUS_READ_FAILED로_처리한다() {
        Instant future = Instant.now().plus(Duration.ofMinutes(30));
        given(pinRepository.findById(PIN_ID))
                .willReturn(Optional.of(pin(VideoStatus.ACTIVE, future, null, THUMBNAIL_KEY)));

        assertThatThrownBy(() -> service.getVideoStatus(OWNER_ID, PIN_ID))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.PIN_STATUS_READ_FAILED);
        // 부분 URL을 만들지 않도록 생성기를 호출하지 않는다.
        verify(s3PresignedUrlGenerator, never()).createDownloadUrl(anyString());
    }

    @Test
    void Presigned_URL_생성_실패면_500_PIN_STATUS_READ_FAILED로_매핑한다() {
        Instant future = Instant.now().plus(Duration.ofMinutes(30));
        given(pinRepository.findById(PIN_ID))
                .willReturn(Optional.of(pin(VideoStatus.ACTIVE, future, BLURRED_KEY, THUMBNAIL_KEY)));
        given(s3PresignedUrlGenerator.createDownloadUrl(anyString()))
                .willThrow(new RuntimeException("presign failed"));

        assertThatThrownBy(() -> service.getVideoStatus(OWNER_ID, PIN_ID))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.PIN_STATUS_READ_FAILED);
    }

    @Test
    void 예상치_못한_오류는_500_PIN_STATUS_READ_FAILED로_매핑한다() {
        given(pinRepository.findById(PIN_ID))
                .willThrow(new DataAccessException("db down") {});

        assertThatThrownBy(() -> service.getVideoStatus(OWNER_ID, PIN_ID))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.PIN_STATUS_READ_FAILED);
    }
}
