package com.yuhan.wagglewaggle.domain.pin.service;

import com.yuhan.wagglewaggle.domain.pin.dto.PinDetail;
import com.yuhan.wagglewaggle.domain.pin.entity.CrowdLevel;
import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import com.yuhan.wagglewaggle.domain.pin.entity.PinTag;
import com.yuhan.wagglewaggle.domain.pin.entity.VideoStatus;
import com.yuhan.wagglewaggle.domain.pin.repository.PinRepository;
import com.yuhan.wagglewaggle.domain.pin.repository.PinTagRepository;
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
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class PinDetailQueryServiceTest {

    @Mock private PinRepository pinRepository;
    @Mock private PinTagRepository pinTagRepository;

    private PinDetailQueryService service;

    private static final UUID PIN_ID = UUID.fromString("11111111-2222-3333-4444-555555555555");
    private static final Long PLACE_ID = 7L;
    private static final double PLACE_LAT = 37.500000;
    private static final double PLACE_LNG = 127.030000;
    private static final String BLURRED_KEY = "pins/blurred/42/blurred.mp4";
    private static final String THUMBNAIL_KEY = "pins/thumbnail/42/thumb.jpg";

    private static final GeometryFactory GF = new GeometryFactory(new PrecisionModel(), 4326);

    @BeforeEach
    void setUp() {
        service = new PinDetailQueryService(pinRepository, pinTagRepository);
    }

    /** 상세 조회에 필요한 작성자·장소·키를 갖춘, 조회 가능한 ACTIVE 핀을 만든다. */
    private Pin activePin() {
        Member member = Member.create("author", AgeGroup.TWENTIES, Gender.FEMALE);
        ReflectionTestUtils.setField(member, "id", 42L);
        ReflectionTestUtils.setField(member, "viewAngle", 120);

        // 위도=getY, 경도=getX 이므로 좌표는 (경도, 위도) 순으로 생성한다.
        Point placePoint = GF.createPoint(new Coordinate(PLACE_LNG, PLACE_LAT));
        Place place = Place.create("kakao-1", "테스트 카페", placePoint);
        ReflectionTestUtils.setField(place, "id", PLACE_ID);

        Pin pin = Pin.create(
                member, place, CrowdLevel.WAGLE,
                GF.createPoint(new Coordinate(127.0, 37.5)),
                "2층 창가", "조용해요", "pins/original/42/original.mp4",
                Instant.now().plus(Duration.ofMinutes(30)));
        ReflectionTestUtils.setField(pin, "id", PIN_ID);
        ReflectionTestUtils.setField(pin, "videoStatus", VideoStatus.ACTIVE);
        ReflectionTestUtils.setField(pin, "createdAt", Instant.parse("2026-08-01T00:00:00Z"));
        ReflectionTestUtils.setField(pin, "blurredVideoKey", BLURRED_KEY);
        ReflectionTestUtils.setField(pin, "thumbnailKey", THUMBNAIL_KEY);
        return pin;
    }

    @Test
    void 조회_가능한_핀이_없으면_PIN_NOT_FOUND() {
        given(pinRepository.findActivePinDetailById(any(), any())).willReturn(Optional.empty());

        assertThatThrownBy(() -> service.getPinDetail(PIN_ID))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.PIN_NOT_FOUND);
        // 조회 불가 시 태그 조회로 넘어가지 않는다.
        verifyNoInteractions(pinTagRepository);
    }

    @Test
    void 조회_가능한_핀의_기본_데이터와_좌표_태그를_반환한다() {
        given(pinRepository.findActivePinDetailById(any(), any())).willReturn(Optional.of(activePin()));
        given(pinTagRepository.findByPin_IdIn(anyCollection())).willReturn(List.of(
                pinTag("카페"), pinTag("조용함")));

        PinDetail detail = service.getPinDetail(PIN_ID);

        assertThat(detail.pinId()).isEqualTo(PIN_ID);
        assertThat(detail.authorNickname()).isEqualTo("author");
        assertThat(detail.authorViewAngle()).isEqualTo(120);
        assertThat(detail.createdAt()).isEqualTo(Instant.parse("2026-08-01T00:00:00Z"));
        assertThat(detail.placeId()).isEqualTo(PLACE_ID);
        assertThat(detail.kakaoPlaceId()).isEqualTo("kakao-1");
        assertThat(detail.placeName()).isEqualTo("테스트 카페");
        assertThat(detail.latitude()).isEqualTo(PLACE_LAT);
        assertThat(detail.longitude()).isEqualTo(PLACE_LNG);
        assertThat(detail.crowdLevel()).isEqualTo(CrowdLevel.WAGLE);
        assertThat(detail.detailLocation()).isEqualTo("2층 창가");
        assertThat(detail.memo()).isEqualTo("조용해요");
        assertThat(detail.tags()).containsExactly("카페", "조용함");
        // 내부 URL 생성용 키는 결과 모델에는 담되 이후 단계에서만 사용한다.
        assertThat(detail.blurredVideoKey()).isEqualTo(BLURRED_KEY);
        assertThat(detail.thumbnailKey()).isEqualTo(THUMBNAIL_KEY);
        assertThat(detail.expiresAt()).isNotNull();
    }

    @Test
    void 태그가_없으면_빈_목록을_반환한다() {
        given(pinRepository.findActivePinDetailById(any(), any())).willReturn(Optional.of(activePin()));
        given(pinTagRepository.findByPin_IdIn(anyCollection())).willReturn(List.of());

        PinDetail detail = service.getPinDetail(PIN_ID);

        assertThat(detail.tags()).isEmpty();
    }

    private PinTag pinTag(String tag) {
        return PinTag.create(null, tag);
    }
}
