package com.yuhan.wagglewaggle.domain.pin.service;

import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJob;
import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJobStatus;
import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJobType;
import com.yuhan.wagglewaggle.domain.blur.repository.AiBlurJobRepository;
import com.yuhan.wagglewaggle.domain.pin.dto.ValidatedPinUpdate;
import com.yuhan.wagglewaggle.domain.pin.entity.CrowdLevel;
import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import com.yuhan.wagglewaggle.domain.pin.entity.PinTag;
import com.yuhan.wagglewaggle.domain.pin.entity.VideoStatus;
import com.yuhan.wagglewaggle.domain.pin.repository.PinRepository;
import com.yuhan.wagglewaggle.domain.pin.repository.PinTagRepository;
import com.yuhan.wagglewaggle.domain.place.entity.Place;
import com.yuhan.wagglewaggle.domain.place.repository.PlaceRepository;
import com.yuhan.wagglewaggle.domain.user.entity.AgeGroup;
import com.yuhan.wagglewaggle.domain.user.entity.Gender;
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
import org.mockito.ArgumentCaptor;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PinUpdatePersistenceServiceTest {

    @Mock private PinRepository pinRepository;
    @Mock private PlaceRepository placeRepository;
    @Mock private PinTagRepository pinTagRepository;
    @Mock private AiBlurJobRepository aiBlurJobRepository;

    private PinUpdatePersistenceService service;

    private static final Long MEMBER_ID = 42L;
    private static final UUID PIN_ID = UUID.fromString("11111111-2222-3333-4444-555555555555");
    private static final Long PLACE_ID = 1L;
    private static final double LAT = 37.500000;
    private static final double LNG = 127.030000;

    private static final GeometryFactory GF = new GeometryFactory(new PrecisionModel(), 4326);

    private Pin pin;

    @BeforeEach
    void setUp() {
        service = new PinUpdatePersistenceService(
                pinRepository, placeRepository, pinTagRepository, aiBlurJobRepository);
        pin = editablePin();
        given(pinRepository.findByIdForUpdate(PIN_ID)).willReturn(Optional.of(pin));
        given(aiBlurJobRepository.existsByPinIdAndJobTypeAndStatus(any(), any(), any())).willReturn(false);
        given(pinTagRepository.findByPin_Id(PIN_ID)).willReturn(List.of());
    }

    private Pin editablePin() {
        Member member = Member.create("tester", AgeGroup.TWENTIES, Gender.MALE);
        ReflectionTestUtils.setField(member, "id", MEMBER_ID);
        Place place = place(PLACE_ID);
        Pin p = Pin.create(member, place, CrowdLevel.WAGLE, point(LNG, LAT),
                "기존 상세위치", "기존 메모", "pins/original/42/aaa.mp4",
                Instant.now().plus(1, ChronoUnit.HOURS));
        ReflectionTestUtils.setField(p, "id", PIN_ID);
        ReflectionTestUtils.setField(p, "videoStatus", VideoStatus.ACTIVE);
        return p;
    }

    private Place place(Long id) {
        Place place = Place.create("kakao-" + id, "장소" + id, point(LNG, LAT));
        ReflectionTestUtils.setField(place, "id", id);
        return place;
    }

    private static Point point(double lng, double lat) {
        return GF.createPoint(new Coordinate(lng, lat));
    }

    /** 테스트용 간이 빌더. */
    private ValidatedPinUpdate build(
            PatchField<String> originalVideoKey,
            Place finalPlace, boolean placeChanged,
            double finalLat, double finalLng, boolean captureChanged,
            PatchField<CrowdLevel> crowdLevel,
            PatchField<String> detailLocation,
            PatchField<String> memo,
            PatchField<List<String>> tags) {
        return new ValidatedPinUpdate(PIN_ID, MEMBER_ID, originalVideoKey, finalPlace, placeChanged,
                finalLat, finalLng, captureChanged, crowdLevel, detailLocation, memo, tags);
    }

    private <T> PatchField<T> abs() {
        return PatchField.absent();
    }

    private ValidatedPinUpdate keepAllExcept(PatchField<CrowdLevel> crowdLevel,
                                             PatchField<String> detailLocation,
                                             PatchField<String> memo,
                                             PatchField<List<String>> tags) {
        return build(abs(), pin.getPlace(), false, LAT, LNG, false,
                crowdLevel, detailLocation, memo, tags);
    }

    @Test
    void memo만_변경되면_updatedFields에_memo만_담긴다() {
        ValidatedPinUpdate validated = keepAllExcept(abs(), abs(), PatchField.of("새 메모"), abs());

        PinUpdatePersistenceService.Result result = service.apply(validated, null);

        assertThat(result.updatedFields()).containsExactly("memo");
        assertThat(pin.getMemo()).isEqualTo("새 메모");
        assertThat(result.aiBlurJob()).isNull();
        assertThat(result.videoStatus()).isEqualTo(VideoStatus.ACTIVE);
    }

    @Test
    void 기존과_동일한_memo면_updatedFields에_포함되지_않는다() {
        ValidatedPinUpdate validated = keepAllExcept(abs(), abs(), PatchField.of("기존 메모"), abs());

        PinUpdatePersistenceService.Result result = service.apply(validated, null);

        assertThat(result.updatedFields()).isEmpty();
    }

    @Test
    void detailLocation_명시적_null이면_삭제되고_updatedFields에_담긴다() {
        ValidatedPinUpdate validated = keepAllExcept(abs(), PatchField.ofNull(), abs(), abs());

        PinUpdatePersistenceService.Result result = service.apply(validated, null);

        assertThat(result.updatedFields()).containsExactly("detailLocation");
        assertThat(pin.getDetailLocation()).isNull();
    }

    @Test
    void crowdLevel이_변경되면_updatedFields에_crowdLevel이_담긴다() {
        ValidatedPinUpdate validated = keepAllExcept(PatchField.of(CrowdLevel.RELAXED), abs(), abs(), abs());

        PinUpdatePersistenceService.Result result = service.apply(validated, null);

        assertThat(result.updatedFields()).containsExactly("crowdLevel");
        assertThat(pin.getCrowdLevel()).isEqualTo(CrowdLevel.RELAXED);
    }

    @Test
    void placeId가_변경되면_updatedFields에_placeId가_담긴다() {
        Place newPlace = place(2L);
        given(placeRepository.getReferenceById(2L)).willReturn(newPlace);
        ValidatedPinUpdate validated = build(abs(), newPlace, true, LAT, LNG, false,
                abs(), abs(), abs(), abs());

        PinUpdatePersistenceService.Result result = service.apply(validated, null);

        assertThat(result.updatedFields()).containsExactly("placeId");
        assertThat(pin.getPlace()).isSameAs(newPlace);
    }

    @Test
    void 같은_placeId면_변경으로_보지_않는다() {
        Place samePlace = place(PLACE_ID);
        ValidatedPinUpdate validated = build(abs(), samePlace, true, LAT, LNG, false,
                abs(), abs(), abs(), abs());

        PinUpdatePersistenceService.Result result = service.apply(validated, null);

        assertThat(result.updatedFields()).isEmpty();
    }

    @Test
    void 좌표가_변경되면_latitude_longitude가_담긴다() {
        ValidatedPinUpdate validated = build(abs(), pin.getPlace(), false,
                LAT + 0.0003, LNG + 0.0003, true, abs(), abs(), abs(), abs());

        PinUpdatePersistenceService.Result result = service.apply(validated, null);

        assertThat(result.updatedFields()).containsExactly("latitude", "longitude");
        assertThat(pin.getCaptureLocation().getY()).isEqualTo(LAT + 0.0003);
        assertThat(pin.getCaptureLocation().getX()).isEqualTo(LNG + 0.0003);
    }

    @Test
    void tags가_전달되면_기존_태그를_교체하고_updatedFields에_담긴다() {
        given(pinTagRepository.findByPin_Id(PIN_ID))
                .willReturn(List.of(PinTag.create(pin, "old")));
        ValidatedPinUpdate validated = keepAllExcept(abs(), abs(), abs(),
                PatchField.of(List.of("카페", "조용함")));

        PinUpdatePersistenceService.Result result = service.apply(validated, null);

        assertThat(result.updatedFields()).containsExactly("tags");
        verify(pinTagRepository).deleteAll(any());
        ArgumentCaptor<PinTag> captor = ArgumentCaptor.forClass(PinTag.class);
        verify(pinTagRepository, org.mockito.Mockito.times(2)).save(captor.capture());
        assertThat(captor.getAllValues()).extracting(PinTag::getTag).containsExactly("카페", "조용함");
    }

    @Test
    void tags가_기존과_동일하면_교체하지_않는다() {
        given(pinTagRepository.findByPin_Id(PIN_ID))
                .willReturn(List.of(PinTag.create(pin, "카페"), PinTag.create(pin, "조용함")));
        ValidatedPinUpdate validated = keepAllExcept(abs(), abs(), abs(),
                PatchField.of(List.of("조용함", "카페")));

        PinUpdatePersistenceService.Result result = service.apply(validated, null);

        assertThat(result.updatedFields()).isEmpty();
        verify(pinTagRepository, never()).deleteAll(any());
        verify(pinTagRepository, never()).save(any());
    }

    @Test
    void tags_빈_배열이면_기존_태그를_모두_삭제한다() {
        given(pinTagRepository.findByPin_Id(PIN_ID))
                .willReturn(List.of(PinTag.create(pin, "카페")));
        ValidatedPinUpdate validated = keepAllExcept(abs(), abs(), abs(), PatchField.of(List.of()));

        PinUpdatePersistenceService.Result result = service.apply(validated, null);

        assertThat(result.updatedFields()).containsExactly("tags");
        verify(pinTagRepository).deleteAll(any());
        verify(pinTagRepository, never()).save(any());
    }

    @Test
    void 영상_교체면_VIDEO_REPLACEMENT_PENDING_작업을_생성한다() {
        String key = "pins/original/42/bbb.mp4";
        ValidatedPinUpdate validated = keepAllExcept(abs(), abs(), abs(), abs());

        PinUpdatePersistenceService.Result result = service.apply(validated, key);

        assertThat(result.aiBlurJob()).isNotNull();
        assertThat(result.aiBlurJob().getJobType()).isEqualTo(AiBlurJobType.VIDEO_REPLACEMENT);
        assertThat(result.aiBlurJob().getStatus()).isEqualTo(AiBlurJobStatus.PENDING);
        assertThat(result.aiBlurJob().getOriginalVideoKey()).isEqualTo(key);
        assertThat(result.aiBlurJob().getPinId()).isEqualTo(PIN_ID);
        verify(aiBlurJobRepository).save(any(AiBlurJob.class));
    }

    @Test
    void 진행_중_교체_작업이_있으면_PIN_UPDATE_IN_PROGRESS() {
        given(aiBlurJobRepository.existsByPinIdAndJobTypeAndStatus(
                PIN_ID, AiBlurJobType.VIDEO_REPLACEMENT, AiBlurJobStatus.PENDING)).willReturn(true);
        ValidatedPinUpdate validated = keepAllExcept(abs(), abs(), abs(), abs());

        assertThatThrownBy(() -> service.apply(validated, "pins/original/42/bbb.mp4"))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.PIN_UPDATE_IN_PROGRESS);
        verify(aiBlurJobRepository, never()).save(any());
    }

    @Test
    void 잠금_후_삭제된_핀이면_PIN_NOT_FOUND() {
        ReflectionTestUtils.setField(pin, "deletedAt", Instant.now());
        ValidatedPinUpdate validated = keepAllExcept(abs(), abs(), PatchField.of("m"), abs());

        assertThatThrownBy(() -> service.apply(validated, null))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.PIN_NOT_FOUND);
    }

    @Test
    void 잠금_후_ACTIVE가_아니면_PIN_NOT_EDITABLE() {
        ReflectionTestUtils.setField(pin, "videoStatus", VideoStatus.PENDING);
        ValidatedPinUpdate validated = keepAllExcept(abs(), abs(), PatchField.of("m"), abs());

        assertThatThrownBy(() -> service.apply(validated, null))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.PIN_NOT_EDITABLE);
    }
}
