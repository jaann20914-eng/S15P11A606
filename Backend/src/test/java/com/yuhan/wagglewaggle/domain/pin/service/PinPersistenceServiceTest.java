package com.yuhan.wagglewaggle.domain.pin.service;

import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJob;
import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJobStatus;
import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJobType;
import com.yuhan.wagglewaggle.domain.blur.repository.AiBlurJobRepository;
import com.yuhan.wagglewaggle.domain.pin.dto.ValidatedPinCreation;
import com.yuhan.wagglewaggle.domain.pin.entity.CrowdLevel;
import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import com.yuhan.wagglewaggle.domain.pin.entity.PinTag;
import com.yuhan.wagglewaggle.domain.pin.entity.VideoStatus;
import com.yuhan.wagglewaggle.domain.pin.repository.PinRepository;
import com.yuhan.wagglewaggle.domain.pin.repository.PinTagRepository;
import com.yuhan.wagglewaggle.domain.place.entity.Place;
import com.yuhan.wagglewaggle.domain.place.repository.PlaceRepository;
import com.yuhan.wagglewaggle.domain.user.entity.Member;
import com.yuhan.wagglewaggle.domain.user.repository.MemberRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.PrecisionModel;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PinPersistenceServiceTest {

    @Mock private MemberRepository memberRepository;
    @Mock private PlaceRepository placeRepository;
    @Mock private PinRepository pinRepository;
    @Mock private PinTagRepository pinTagRepository;
    @Mock private AiBlurJobRepository aiBlurJobRepository;

    private PinPersistenceService service;

    private static final Long MEMBER_ID = 42L;
    private static final String KAKAO_PLACE_ID = "kakao-1";
    private static final String PLACE_NAME = "테스트 장소";
    private static final double PLACE_LAT = 37.500000;
    private static final double PLACE_LNG = 127.030000;
    private static final double CAPTURE_LAT = 37.500100;
    private static final double CAPTURE_LNG = 127.030100;
    private static final String KEY = "pins/original/42/11111111-2222-3333-4444-555555555555.mp4";
    private static final UUID PIN_ID = UUID.fromString("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");

    private static final GeometryFactory GF = new GeometryFactory(new PrecisionModel(), 4326);

    @BeforeEach
    void setUp() {
        service = new PinPersistenceService(
                memberRepository, placeRepository, pinRepository, pinTagRepository, aiBlurJobRepository);

        given(memberRepository.getReferenceById(anyLong())).willReturn(org.mockito.Mockito.mock(Member.class));
        // save 시 Hibernate가 UUID PK를 부여하는 것을 흉내낸다.
        given(pinRepository.save(any(Pin.class))).willAnswer(invocation -> {
            Pin pin = invocation.getArgument(0);
            ReflectionTestUtils.setField(pin, "id", PIN_ID);
            return pin;
        });
    }

    private ValidatedPinCreation validated(List<String> tags) {
        return new ValidatedPinCreation(
                MEMBER_ID, KEY, KAKAO_PLACE_ID, PLACE_NAME,
                PLACE_LAT, PLACE_LNG, CAPTURE_LAT, CAPTURE_LNG,
                "2층 창가", CrowdLevel.WAGLE, "메모", tags);
    }

    @Test
    void 기존_장소가_있으면_재사용하고_Pin_PinTag_AiBlurJob을_저장한다() {
        Place existing = Place.create(KAKAO_PLACE_ID, PLACE_NAME,
                GF.createPoint(new Coordinate(PLACE_LNG, PLACE_LAT)));
        given(placeRepository.findFirstByKakaoPlaceId(KAKAO_PLACE_ID)).willReturn(Optional.of(existing));

        PinPersistenceService.Result result = service.save(validated(List.of("카페", "조용함")));

        // 장소 신규 저장은 없어야 한다.
        verify(placeRepository, never()).save(any());

        // Pin 저장 내용 검증: videoStatus PENDING, 촬영 좌표, 원본 키, 만료 null.
        ArgumentCaptor<Pin> pinCaptor = ArgumentCaptor.forClass(Pin.class);
        verify(pinRepository).save(pinCaptor.capture());
        Pin savedPin = pinCaptor.getValue();
        assertThat(savedPin.getVideoStatus()).isEqualTo(VideoStatus.PENDING);
        assertThat(savedPin.getCrowdLevel()).isEqualTo(CrowdLevel.WAGLE);
        assertThat(savedPin.getOriginalVideoKey()).isEqualTo(KEY);
        assertThat(savedPin.getExpiresAt()).isNull();
        assertThat(savedPin.getCaptureLocation().getX()).isEqualTo(CAPTURE_LNG);
        assertThat(savedPin.getCaptureLocation().getY()).isEqualTo(CAPTURE_LAT);

        // PinTag 2건 저장.
        ArgumentCaptor<PinTag> tagCaptor = ArgumentCaptor.forClass(PinTag.class);
        verify(pinTagRepository, org.mockito.Mockito.times(2)).save(tagCaptor.capture());
        assertThat(tagCaptor.getAllValues()).extracting(PinTag::getTag).containsExactly("카페", "조용함");

        // AiBlurJob 저장 내용 검증: pinId, 원본 키, INITIAL_UPLOAD, PENDING.
        ArgumentCaptor<AiBlurJob> jobCaptor = ArgumentCaptor.forClass(AiBlurJob.class);
        verify(aiBlurJobRepository).save(jobCaptor.capture());
        AiBlurJob savedJob = jobCaptor.getValue();
        assertThat(savedJob.getPinId()).isEqualTo(PIN_ID);
        assertThat(savedJob.getOriginalVideoKey()).isEqualTo(KEY);
        assertThat(savedJob.getJobType()).isEqualTo(AiBlurJobType.INITIAL_UPLOAD);
        assertThat(savedJob.getStatus()).isEqualTo(AiBlurJobStatus.PENDING);

        assertThat(result.pin().getId()).isEqualTo(PIN_ID);
        assertThat(result.aiBlurJob()).isSameAs(savedJob);
    }

    @Test
    void 장소가_없으면_서버_확인_정보로_새_장소를_저장한다() {
        given(placeRepository.findFirstByKakaoPlaceId(KAKAO_PLACE_ID)).willReturn(Optional.empty());
        given(placeRepository.save(any(Place.class))).willAnswer(invocation -> invocation.getArgument(0));

        service.save(validated(List.of()));

        ArgumentCaptor<Place> placeCaptor = ArgumentCaptor.forClass(Place.class);
        verify(placeRepository).save(placeCaptor.capture());
        Place savedPlace = placeCaptor.getValue();
        assertThat(savedPlace.getKakaoPlaceId()).isEqualTo(KAKAO_PLACE_ID);
        assertThat(savedPlace.getName()).isEqualTo(PLACE_NAME);
        assertThat(savedPlace.getLocation().getX()).isEqualTo(PLACE_LNG);
        assertThat(savedPlace.getLocation().getY()).isEqualTo(PLACE_LAT);
    }

    @Test
    void 태그가_없으면_PinTag를_저장하지_않는다() {
        given(placeRepository.findFirstByKakaoPlaceId(KAKAO_PLACE_ID))
                .willReturn(Optional.of(Place.create(KAKAO_PLACE_ID, PLACE_NAME,
                        GF.createPoint(new Coordinate(PLACE_LNG, PLACE_LAT)))));

        service.save(validated(List.of()));

        verify(pinTagRepository, never()).save(any());
    }

    @Test
    void 저장_중_실패하면_이후_저장을_진행하지_않고_예외를_전파한다() {
        given(placeRepository.findFirstByKakaoPlaceId(KAKAO_PLACE_ID))
                .willReturn(Optional.of(Place.create(KAKAO_PLACE_ID, PLACE_NAME,
                        GF.createPoint(new Coordinate(PLACE_LNG, PLACE_LAT)))));
        given(pinRepository.save(any(Pin.class))).willThrow(new RuntimeException("DB 오류"));

        assertThatThrownBy(() -> service.save(validated(List.of("카페"))))
                .isInstanceOf(RuntimeException.class);

        // Pin 저장이 실패하면 PinTag·AiBlurJob 저장은 시도되지 않는다(트랜잭션 롤백 대상).
        verify(pinTagRepository, never()).save(any());
        verify(aiBlurJobRepository, never()).save(any());
    }
}
