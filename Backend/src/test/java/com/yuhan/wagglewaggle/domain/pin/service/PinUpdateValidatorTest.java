package com.yuhan.wagglewaggle.domain.pin.service;

import com.yuhan.wagglewaggle.domain.pin.dto.PinUpdateRequest;
import com.yuhan.wagglewaggle.domain.pin.dto.ValidatedPinUpdate;
import com.yuhan.wagglewaggle.domain.pin.entity.CrowdLevel;
import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import com.yuhan.wagglewaggle.domain.pin.entity.VideoStatus;
import com.yuhan.wagglewaggle.domain.pin.repository.PinRepository;
import com.yuhan.wagglewaggle.domain.place.entity.Place;
import com.yuhan.wagglewaggle.domain.place.repository.PlaceRepository;
import com.yuhan.wagglewaggle.domain.user.entity.Member;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import com.yuhan.wagglewaggle.global.jackson.PatchField;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PinUpdateValidatorTest {

    @Mock private PinRepository pinRepository;
    @Mock private PlaceRepository placeRepository;

    private PinUpdateValidator validator;

    private static final Long MEMBER_ID = 42L;
    private static final String PIN_ID = "11111111-2222-3333-4444-555555555555";
    private static final double PLACE_LAT = 37.500000;
    private static final double PLACE_LNG = 127.030000;
    /** 😀 U+1F600: 자소 클러스터 1개, UTF-16 기준 2코드유닛. */
    private static final String EMOJI = "😀";

    private static final GeometryFactory GF = new GeometryFactory(new PrecisionModel(), 4326);

    @BeforeEach
    void setUp() {
        validator = new PinUpdateValidator(pinRepository, placeRepository, new PinTagNormalizer());
        given(pinRepository.findByIdWithMemberAndPlace(UUID.fromString(PIN_ID)))
                .willReturn(Optional.of(editablePin()));
    }

    /** ACTIVE·미삭제·미만료·작성자 일치인 기본 수정 가능 핀. 장소=촬영 좌표 동일(거리 0). */
    private Pin editablePin() {
        return pin(VideoStatus.ACTIVE, null, Instant.now().plus(1, ChronoUnit.HOURS),
                point(PLACE_LNG, PLACE_LAT));
    }

    private Pin pin(VideoStatus status, Instant deletedAt, Instant expiresAt, Point capture) {
        Member member = Member.create("tester", null, null);
        ReflectionTestUtils.setField(member, "id", MEMBER_ID);
        Place place = Place.create("kakao-1", "테스트 장소", point(PLACE_LNG, PLACE_LAT));

        Pin pin = Pin.create(member, place, CrowdLevel.WAGLE, capture,
                "기존 상세위치", "기존 메모", "pins/original/42/aaa.mp4", expiresAt);
        ReflectionTestUtils.setField(pin, "id", UUID.fromString(PIN_ID));
        ReflectionTestUtils.setField(pin, "videoStatus", status);
        ReflectionTestUtils.setField(pin, "deletedAt", deletedAt);
        return pin;
    }

    private static Point point(double lng, double lat) {
        return GF.createPoint(new Coordinate(lng, lat));
    }

    // --- 요청 빌더 헬퍼 ---
    private PinUpdateRequest req(PatchField<String> originalVideoKey, PatchField<Long> placeId,
                                 PatchField<Double> latitude, PatchField<Double> longitude,
                                 PatchField<String> detailLocation, PatchField<String> crowdLevel,
                                 PatchField<String> memo, PatchField<List<String>> tags) {
        return new PinUpdateRequest(originalVideoKey, placeId, latitude, longitude,
                detailLocation, crowdLevel, memo, tags);
    }

    private <T> PatchField<T> abs() {
        return PatchField.absent();
    }

    /** memo만 변경하는 최소 유효 요청. */
    private PinUpdateRequest memoOnly(String memo) {
        return req(abs(), abs(), abs(), abs(), abs(), abs(), PatchField.of(memo), abs());
    }

    private ValidatedPinUpdate validate(PinUpdateRequest request) {
        return validator.validate(MEMBER_ID, PIN_ID, request);
    }

    private void assertError(PinUpdateRequest request, ErrorCode expected) {
        assertThatThrownBy(() -> validate(request))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(expected);
    }

    // ================= Pin 검증 순서 =================

    @Test
    void pinId_형식이_잘못되면_INVALID_PIN_ID() {
        assertThatThrownBy(() -> validator.validate(MEMBER_ID, "not-a-uuid", memoOnly("m")))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.INVALID_PIN_ID);
    }

    @Test
    void 핀이_없으면_PIN_NOT_FOUND() {
        given(pinRepository.findByIdWithMemberAndPlace(UUID.fromString(PIN_ID)))
                .willReturn(Optional.empty());

        assertError(memoOnly("m"), ErrorCode.PIN_NOT_FOUND);
    }

    @Test
    void 삭제된_핀이면_PIN_NOT_FOUND() {
        given(pinRepository.findByIdWithMemberAndPlace(UUID.fromString(PIN_ID)))
                .willReturn(Optional.of(pin(VideoStatus.ACTIVE, Instant.now(),
                        Instant.now().plus(1, ChronoUnit.HOURS), point(PLACE_LNG, PLACE_LAT))));

        assertError(memoOnly("m"), ErrorCode.PIN_NOT_FOUND);
    }

    @Test
    void 만료된_핀이면_PIN_NOT_FOUND() {
        given(pinRepository.findByIdWithMemberAndPlace(UUID.fromString(PIN_ID)))
                .willReturn(Optional.of(pin(VideoStatus.ACTIVE, null,
                        Instant.now().minus(1, ChronoUnit.MINUTES), point(PLACE_LNG, PLACE_LAT))));

        assertError(memoOnly("m"), ErrorCode.PIN_NOT_FOUND);
    }

    @Test
    void 작성자가_아니면_PIN_UPDATE_FORBIDDEN() {
        assertThatThrownBy(() -> validator.validate(999L, PIN_ID, memoOnly("m")))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.PIN_UPDATE_FORBIDDEN);
    }

    @Test
    void ACTIVE가_아니면_PIN_NOT_EDITABLE() {
        given(pinRepository.findByIdWithMemberAndPlace(UUID.fromString(PIN_ID)))
                .willReturn(Optional.of(pin(VideoStatus.PENDING, null,
                        Instant.now().plus(1, ChronoUnit.HOURS), point(PLACE_LNG, PLACE_LAT))));

        assertError(memoOnly("m"), ErrorCode.PIN_NOT_EDITABLE);
    }

    // ================= 요청 검증 =================

    @Test
    void 수정_필드가_하나도_없으면_INVALID_PIN_UPDATE_REQUEST() {
        assertError(req(abs(), abs(), abs(), abs(), abs(), abs(), abs(), abs()),
                ErrorCode.INVALID_PIN_UPDATE_REQUEST);
    }

    @Test
    void 좌표를_하나만_전달하면_INVALID_PIN_UPDATE_REQUEST() {
        PinUpdateRequest onlyLat = req(abs(), abs(), PatchField.of(PLACE_LAT), abs(),
                abs(), abs(), abs(), abs());

        assertError(onlyLat, ErrorCode.INVALID_PIN_UPDATE_REQUEST);
    }

    @Test
    void detailLocation이_100자를_초과하면_INVALID_PIN_UPDATE_REQUEST() {
        PinUpdateRequest request = req(abs(), abs(), abs(), abs(),
                PatchField.of("a".repeat(101)), abs(), abs(), abs());

        assertError(request, ErrorCode.INVALID_PIN_UPDATE_REQUEST);
    }

    @Test
    void memo가_50자를_초과하면_INVALID_PIN_UPDATE_REQUEST() {
        assertError(memoOnly("a".repeat(51)), ErrorCode.INVALID_PIN_UPDATE_REQUEST);
    }

    @Test
    void memo가_이모지_50자면_통과한다() {
        // String.length() 기준이면 100(=2×50)이라 거부됐지만, 자소 클러스터 기준 50자라 통과한다.
        ValidatedPinUpdate result = validate(memoOnly(EMOJI.repeat(50)));

        assertThat(result.memo().value()).isEqualTo(EMOJI.repeat(50));
    }

    @Test
    void memo가_이모지_51자를_초과하면_INVALID_PIN_UPDATE_REQUEST() {
        assertError(memoOnly(EMOJI.repeat(51)), ErrorCode.INVALID_PIN_UPDATE_REQUEST);
    }

    @Test
    void 유효하지_않은_crowdLevel이면_INVALID_PIN_UPDATE_REQUEST() {
        PinUpdateRequest request = req(abs(), abs(), abs(), abs(), abs(),
                PatchField.of("CROWDED"), abs(), abs());

        assertError(request, ErrorCode.INVALID_PIN_UPDATE_REQUEST);
    }

    @Test
    void 태그가_3개를_초과하면_INVALID_PIN_UPDATE_REQUEST() {
        PinUpdateRequest request = tagsRequest(List.of("a", "b", "c", "d"));

        assertError(request, ErrorCode.INVALID_PIN_UPDATE_REQUEST);
    }

    @Test
    void 정규화_후_빈_태그면_INVALID_PIN_UPDATE_REQUEST() {
        PinUpdateRequest request = tagsRequest(java.util.Arrays.asList("카페", "   "));

        assertError(request, ErrorCode.INVALID_PIN_UPDATE_REQUEST);
    }

    @Test
    void 태그가_30자를_초과하면_INVALID_PIN_UPDATE_REQUEST() {
        assertError(tagsRequest(List.of("a".repeat(31))), ErrorCode.INVALID_PIN_UPDATE_REQUEST);
    }

    @Test
    void 정규화_후_중복_태그면_INVALID_PIN_UPDATE_REQUEST() {
        assertError(tagsRequest(List.of("카페", " 카페 ")), ErrorCode.INVALID_PIN_UPDATE_REQUEST);
    }

    @Test
    void originalVideoKey가_1024자를_초과하면_INVALID_PIN_UPDATE_REQUEST() {
        PinUpdateRequest request = req(PatchField.of("k".repeat(1025)), abs(), abs(), abs(),
                abs(), abs(), abs(), abs());

        assertError(request, ErrorCode.INVALID_PIN_UPDATE_REQUEST);
    }

    private PinUpdateRequest tagsRequest(List<String> tags) {
        return req(abs(), abs(), abs(), abs(), abs(), abs(), abs(), PatchField.of(tags));
    }

    // ================= 최종 장소·좌표 검증 =================

    @Test
    void placeId가_전달됐지만_장소가_없으면_PLACE_NOT_FOUND() {
        given(placeRepository.findById(7L)).willReturn(Optional.empty());
        PinUpdateRequest request = req(abs(), PatchField.of(7L), abs(), abs(), abs(), abs(), abs(), abs());

        assertError(request, ErrorCode.PLACE_NOT_FOUND);
    }

    @Test
    void 최종_좌표가_장소에서_50m를_초과하면_LOCATION_OUT_OF_RANGE() {
        // 위도 0.001도 ≈ 111m (> 50m)
        PinUpdateRequest request = req(abs(), abs(),
                PatchField.of(PLACE_LAT + 0.001), PatchField.of(PLACE_LNG),
                abs(), abs(), abs(), abs());

        assertError(request, ErrorCode.LOCATION_OUT_OF_RANGE);
    }

    // ================= 생략/삭제/변경 구분 결과 =================

    @Test
    void 메모만_변경하면_나머지는_유지된다() {
        ValidatedPinUpdate result = validate(memoOnly("새 메모"));

        assertThat(result.pinId()).isEqualTo(UUID.fromString(PIN_ID));
        assertThat(result.memberId()).isEqualTo(MEMBER_ID);
        assertThat(result.memo().value()).isEqualTo("새 메모");
        assertThat(result.detailLocation().isAbsent()).isTrue();
        assertThat(result.tags().isAbsent()).isTrue();
        assertThat(result.crowdLevel().isAbsent()).isTrue();
        assertThat(result.placeChanged()).isFalse();
        assertThat(result.captureChanged()).isFalse();
        // 좌표 유지: 기존 촬영 좌표 그대로
        assertThat(result.finalCaptureLatitude()).isEqualTo(PLACE_LAT);
        assertThat(result.finalCaptureLongitude()).isEqualTo(PLACE_LNG);
    }

    @Test
    void detailLocation_명시적_null이면_삭제_의도로_담긴다() {
        PinUpdateRequest request = req(abs(), abs(), abs(), abs(),
                PatchField.ofNull(), abs(), abs(), abs());

        ValidatedPinUpdate result = validate(request);

        assertThat(result.detailLocation().isExplicitNull()).isTrue();
    }

    @Test
    void tags_빈_배열이면_전체_삭제로_담긴다() {
        ValidatedPinUpdate result = validate(tagsRequest(List.of()));

        assertThat(result.tags().isPresent()).isTrue();
        assertThat(result.tags().value()).isEmpty();
    }

    @Test
    void tags_값이면_정규화되어_담긴다() {
        ValidatedPinUpdate result = validate(tagsRequest(List.of(" 카페 ", "조용함")));

        assertThat(result.tags().value()).containsExactly("카페", "조용함");
    }

    @Test
    void placeId만_변경하면_placeChanged가_true다() {
        Place newPlace = Place.create("kakao-2", "새 장소", point(PLACE_LNG, PLACE_LAT));
        given(placeRepository.findById(7L)).willReturn(Optional.of(newPlace));
        PinUpdateRequest request = req(abs(), PatchField.of(7L), abs(), abs(), abs(), abs(), abs(), abs());

        ValidatedPinUpdate result = validate(request);

        assertThat(result.placeChanged()).isTrue();
        assertThat(result.finalPlace()).isSameAs(newPlace);
        assertThat(result.captureChanged()).isFalse();
    }

    @Test
    void 좌표만_변경하면_captureChanged가_true다() {
        // 위도 0.0003도 ≈ 33m (< 50m)
        PinUpdateRequest request = req(abs(), abs(),
                PatchField.of(PLACE_LAT + 0.0003), PatchField.of(PLACE_LNG),
                abs(), abs(), abs(), abs());

        ValidatedPinUpdate result = validate(request);

        assertThat(result.captureChanged()).isTrue();
        assertThat(result.finalCaptureLatitude()).isEqualTo(PLACE_LAT + 0.0003);
        assertThat(result.placeChanged()).isFalse();
    }

    @Test
    void placeId와_좌표를_모두_변경할_수_있다() {
        Place newPlace = Place.create("kakao-2", "새 장소", point(PLACE_LNG, PLACE_LAT + 0.0003));
        given(placeRepository.findById(7L)).willReturn(Optional.of(newPlace));
        PinUpdateRequest request = req(abs(), PatchField.of(7L),
                PatchField.of(PLACE_LAT + 0.0003), PatchField.of(PLACE_LNG),
                abs(), abs(), abs(), abs());

        ValidatedPinUpdate result = validate(request);

        assertThat(result.placeChanged()).isTrue();
        assertThat(result.captureChanged()).isTrue();
    }

    @Test
    void crowdLevel_변경은_enum으로_담긴다() {
        PinUpdateRequest request = req(abs(), abs(), abs(), abs(), abs(),
                PatchField.of("RELAXED"), abs(), abs());

        ValidatedPinUpdate result = validate(request);

        assertThat(result.crowdLevel().value()).isEqualTo(CrowdLevel.RELAXED);
    }
}
