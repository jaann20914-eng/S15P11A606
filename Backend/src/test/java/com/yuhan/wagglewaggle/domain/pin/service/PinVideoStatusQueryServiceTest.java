package com.yuhan.wagglewaggle.domain.pin.service;

import com.yuhan.wagglewaggle.domain.pin.dto.PinVideoStatusResult;
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
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;

@ExtendWith(MockitoExtension.class)
class PinVideoStatusQueryServiceTest {

    @Mock private PinRepository pinRepository;

    private PinVideoStatusQueryService service;

    private static final Long OWNER_ID = 42L;
    private static final Long OTHER_ID = 99L;
    private static final UUID PIN_ID = UUID.fromString("11111111-2222-3333-4444-555555555555");
    private static final String BLURRED_KEY = "pins/blurred/42/blurred.mp4";
    private static final String THUMBNAIL_KEY = "pins/thumbnail/42/thumb.jpg";
    // activate()에 넘기는 처리 시각. 저장되는 expiresAt은 이 값 기준 1시간 뒤다.
    private static final Instant PROCESSED_AT = Instant.parse("2026-08-01T00:00:00Z");
    private static final Instant EXPIRES_AT = PROCESSED_AT.plus(Duration.ofHours(1));

    private static final GeometryFactory GF = new GeometryFactory(new PrecisionModel(), 4326);

    @BeforeEach
    void setUp() {
        service = new PinVideoStatusQueryService(pinRepository);
    }

    /** videoStatus를 지정한, OWNER_ID 소유의 핀을 만든다. */
    private Pin pin(VideoStatus status) {
        Member member = Member.create("owner", AgeGroup.TWENTIES, Gender.MALE);
        ReflectionTestUtils.setField(member, "id", OWNER_ID);

        Pin pin = Pin.create(
                member, mock(Place.class), CrowdLevel.WAGLE,
                GF.createPoint(new Coordinate(127.0, 37.5)),
                null, null, "pins/original/42/original.mp4", null);
        ReflectionTestUtils.setField(pin, "id", PIN_ID);

        switch (status) {
            case PENDING -> { /* 기본값 유지 */ }
            case ACTIVE -> pin.activate(BLURRED_KEY, THUMBNAIL_KEY, PROCESSED_AT);
            case REJECTED -> pin.reject();
            case FAILED -> pin.markFailed();
        }
        return pin;
    }

    @Test
    void 핀이_없으면_PIN_NOT_FOUND() {
        given(pinRepository.findById(PIN_ID)).willReturn(Optional.empty());

        assertThatThrownBy(() -> service.getVideoStatus(OWNER_ID, PIN_ID))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.PIN_NOT_FOUND);
    }

    @Test
    void 게시자가_아니면_403_PIN_STATUS_READ_FORBIDDEN() {
        given(pinRepository.findById(PIN_ID)).willReturn(Optional.of(pin(VideoStatus.PENDING)));

        assertThatThrownBy(() -> service.getVideoStatus(OTHER_ID, PIN_ID))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.PIN_STATUS_READ_FORBIDDEN);
    }

    @Test
    void PENDING이면_상태와_메시지를_반환하고_키는_없다() {
        given(pinRepository.findById(PIN_ID)).willReturn(Optional.of(pin(VideoStatus.PENDING)));

        PinVideoStatusResult result = service.getVideoStatus(OWNER_ID, PIN_ID);

        assertThat(result.pinId()).isEqualTo(PIN_ID);
        assertThat(result.videoStatus()).isEqualTo(VideoStatus.PENDING);
        assertThat(result.message()).isEqualTo("영상 처리 상태를 조회했습니다.");
        assertThat(result.blurredVideoKey()).isNull();
        assertThat(result.thumbnailKey()).isNull();
        assertThat(result.expiresAt()).isNull();
    }

    @Test
    void ACTIVE이면_내부_처리용_객체_키와_만료_시각을_전달한다() {
        given(pinRepository.findById(PIN_ID)).willReturn(Optional.of(pin(VideoStatus.ACTIVE)));

        PinVideoStatusResult result = service.getVideoStatus(OWNER_ID, PIN_ID);

        assertThat(result.videoStatus()).isEqualTo(VideoStatus.ACTIVE);
        assertThat(result.message()).isEqualTo("영상 처리가 완료되었습니다.");
        assertThat(result.blurredVideoKey()).isEqualTo(BLURRED_KEY);
        assertThat(result.thumbnailKey()).isEqualTo(THUMBNAIL_KEY);
        assertThat(result.expiresAt()).isEqualTo(EXPIRES_AT);
    }

    @Test
    void REJECTED이면_상태와_메시지를_반환하고_키는_없다() {
        given(pinRepository.findById(PIN_ID)).willReturn(Optional.of(pin(VideoStatus.REJECTED)));

        PinVideoStatusResult result = service.getVideoStatus(OWNER_ID, PIN_ID);

        assertThat(result.videoStatus()).isEqualTo(VideoStatus.REJECTED);
        assertThat(result.message()).isEqualTo("영상이 검수 기준을 통과하지 못했습니다.");
        assertThat(result.blurredVideoKey()).isNull();
        assertThat(result.thumbnailKey()).isNull();
        assertThat(result.expiresAt()).isNull();
    }

    @Test
    void FAILED이면_상태와_메시지를_반환하고_키는_없다() {
        given(pinRepository.findById(PIN_ID)).willReturn(Optional.of(pin(VideoStatus.FAILED)));

        PinVideoStatusResult result = service.getVideoStatus(OWNER_ID, PIN_ID);

        assertThat(result.videoStatus()).isEqualTo(VideoStatus.FAILED);
        assertThat(result.message()).isEqualTo("영상 처리 중 오류가 발생했습니다.");
        assertThat(result.blurredVideoKey()).isNull();
        assertThat(result.thumbnailKey()).isNull();
        assertThat(result.expiresAt()).isNull();
    }

    @Test
    void 예상치_못한_오류는_500_PIN_STATUS_READ_FAILED로_매핑한다() {
        given(pinRepository.findById(PIN_ID))
                .willThrow(new DataAccessException("db down") {});

        assertThatThrownBy(() -> service.getVideoStatus(OWNER_ID, PIN_ID))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.PIN_STATUS_READ_FAILED);
    }

    @Test
    void 도메인_예외는_500으로_덮이지_않고_그대로_전파된다() {
        given(pinRepository.findById(PIN_ID)).willReturn(Optional.empty());

        assertThatThrownBy(() -> service.getVideoStatus(OWNER_ID, PIN_ID))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.PIN_NOT_FOUND);
    }
}
