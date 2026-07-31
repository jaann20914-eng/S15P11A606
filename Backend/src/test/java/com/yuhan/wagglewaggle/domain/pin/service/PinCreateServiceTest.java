package com.yuhan.wagglewaggle.domain.pin.service;

import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJob;
import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJobType;
import com.yuhan.wagglewaggle.domain.blur.publisher.AiBlurJobPublisher;
import com.yuhan.wagglewaggle.domain.blur.repository.AiBlurJobRepository;
import com.yuhan.wagglewaggle.domain.pin.dto.PinCreateRequest;
import com.yuhan.wagglewaggle.domain.pin.dto.PinCreateResponse;
import com.yuhan.wagglewaggle.domain.pin.dto.ValidatedPinCreation;
import com.yuhan.wagglewaggle.domain.pin.entity.CrowdLevel;
import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import com.yuhan.wagglewaggle.domain.pin.entity.VideoStatus;
import com.yuhan.wagglewaggle.domain.pin.repository.PinRepository;
import com.yuhan.wagglewaggle.domain.place.client.KakaoLocalClient;
import com.yuhan.wagglewaggle.domain.place.client.dto.KakaoKeywordResponse;
import com.yuhan.wagglewaggle.domain.place.entity.Place;
import com.yuhan.wagglewaggle.domain.place.repository.PlaceRepository;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import com.yuhan.wagglewaggle.global.properties.PinRegistrationProperties;
import com.yuhan.wagglewaggle.global.properties.PinUploadProperties;
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

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PinCreateServiceTest {

    @Mock private S3ObjectInspector s3ObjectInspector;
    @Mock private PinRepository pinRepository;
    @Mock private AiBlurJobRepository aiBlurJobRepository;
    @Mock private PlaceRepository placeRepository;
    @Mock private KakaoLocalClient kakaoLocalClient;
    @Mock private PinPersistenceService pinPersistenceService;
    @Mock private AiBlurJobPublisher aiBlurJobPublisher;

    private PinCreateService service;

    private static final Long MEMBER_ID = 42L;
    private static final long MAX_SIZE = 104_857_600L; // 100MB
    private static final String VALID_KEY =
            "pins/original/42/11111111-2222-3333-4444-555555555555.mp4";
    private static final String KAKAO_PLACE_ID = "kakao-1";
    private static final String PLACE_NAME = "테스트 장소";
    private static final double PLACE_LAT = 37.500000;
    private static final double PLACE_LNG = 127.030000;

    private static final GeometryFactory GF = new GeometryFactory(new PrecisionModel(), 4326);

    @BeforeEach
    void setUp() {
        service = buildService(new PinRegistrationProperties(0)); // 일일 제한 미적용

        given(s3ObjectInspector.findObjectMetadata(VALID_KEY))
                .willReturn(Optional.of(new S3VideoObjectMetadata("video/mp4", 5_242_880L)));
        given(pinRepository.existsByOriginalVideoKey(anyString())).willReturn(false);
        given(aiBlurJobRepository.existsByOriginalVideoKey(anyString())).willReturn(false);
        given(placeRepository.findFirstByKakaoPlaceId(KAKAO_PLACE_ID))
                .willReturn(Optional.of(Place.create(
                        KAKAO_PLACE_ID, PLACE_NAME, GF.createPoint(new Coordinate(PLACE_LNG, PLACE_LAT)))));
    }

    private PinCreateService buildService(PinRegistrationProperties registrationProperties) {
        return new PinCreateService(
                s3ObjectInspector, pinRepository, aiBlurJobRepository, placeRepository,
                kakaoLocalClient, new PinTagNormalizer(),
                pinPersistenceService, aiBlurJobPublisher,
                new PinUploadProperties(MAX_SIZE), registrationProperties);
    }

    /** 촬영 좌표만 바꿔 기본 유효 요청을 만든다. */
    private PinCreateRequest request(double captureLat, double captureLng) {
        return request(VALID_KEY, "WAGLE", captureLat, captureLng, null);
    }

    private PinCreateRequest request(String key, String crowdLevel,
                                     double captureLat, double captureLng, List<String> tags) {
        return new PinCreateRequest(
                key, KAKAO_PLACE_ID, PLACE_NAME,
                PLACE_LAT, PLACE_LNG,          // Front가 보낸 참고 좌표(신뢰하지 않음)
                captureLat, captureLng,
                "2층 창가", crowdLevel, "메모", tags);
    }

    @Test
    void 정상_객체_키면_검증을_통과하고_신뢰값을_반환한다() {
        ValidatedPinCreation result = service.validate(MEMBER_ID, request(PLACE_LAT, PLACE_LNG));

        assertThat(result.memberId()).isEqualTo(MEMBER_ID);
        assertThat(result.originalVideoKey()).isEqualTo(VALID_KEY);
        assertThat(result.kakaoPlaceId()).isEqualTo(KAKAO_PLACE_ID);
        assertThat(result.resolvedPlaceName()).isEqualTo(PLACE_NAME);
        assertThat(result.placeLatitude()).isEqualTo(PLACE_LAT);
        assertThat(result.placeLongitude()).isEqualTo(PLACE_LNG);
        assertThat(result.crowdLevel()).isEqualTo(CrowdLevel.WAGLE);
        assertThat(result.tags()).isEmpty();
    }

    @Test
    void 객체_키_형식이_잘못되면_VIDEO_NOT_ACCESSIBLE() {
        PinCreateRequest request = request("pins/original/42/not-a-uuid.mp4", "WAGLE", PLACE_LAT, PLACE_LNG, null);

        assertError(request, ErrorCode.VIDEO_NOT_ACCESSIBLE);
    }

    @Test
    void 다른_회원_ID가_포함된_객체_키면_VIDEO_NOT_ACCESSIBLE() {
        PinCreateRequest request = request(
                "pins/original/99/11111111-2222-3333-4444-555555555555.mp4", "WAGLE", PLACE_LAT, PLACE_LNG, null);

        assertError(request, ErrorCode.VIDEO_NOT_ACCESSIBLE);
    }

    @Test
    void S3_객체가_없으면_VIDEO_NOT_ACCESSIBLE() {
        given(s3ObjectInspector.findObjectMetadata(VALID_KEY)).willReturn(Optional.empty());

        assertError(request(PLACE_LAT, PLACE_LNG), ErrorCode.VIDEO_NOT_ACCESSIBLE);
    }

    @Test
    void Content_Type이_video_mp4가_아니면_VIDEO_NOT_ACCESSIBLE() {
        given(s3ObjectInspector.findObjectMetadata(VALID_KEY))
                .willReturn(Optional.of(new S3VideoObjectMetadata("video/quicktime", 1_000L)));

        assertError(request(PLACE_LAT, PLACE_LNG), ErrorCode.VIDEO_NOT_ACCESSIBLE);
    }

    @Test
    void 파일_크기가_최대치를_초과하면_VIDEO_NOT_ACCESSIBLE() {
        given(s3ObjectInspector.findObjectMetadata(VALID_KEY))
                .willReturn(Optional.of(new S3VideoObjectMetadata("video/mp4", MAX_SIZE + 1)));

        assertError(request(PLACE_LAT, PLACE_LNG), ErrorCode.VIDEO_NOT_ACCESSIBLE);
    }

    @Test
    void 최대_크기_경계값은_허용된다() {
        given(s3ObjectInspector.findObjectMetadata(VALID_KEY))
                .willReturn(Optional.of(new S3VideoObjectMetadata("video/mp4", MAX_SIZE)));

        ValidatedPinCreation result = service.validate(MEMBER_ID, request(PLACE_LAT, PLACE_LNG));

        assertThat(result.originalVideoKey()).isEqualTo(VALID_KEY);
    }

    @Test
    void Pin에_이미_사용된_원본_영상이면_VIDEO_ALREADY_REGISTERED() {
        given(pinRepository.existsByOriginalVideoKey(VALID_KEY)).willReturn(true);

        assertError(request(PLACE_LAT, PLACE_LNG), ErrorCode.VIDEO_ALREADY_REGISTERED);
    }

    @Test
    void AiBlurJob에_이미_사용된_원본_영상이면_VIDEO_ALREADY_REGISTERED() {
        given(aiBlurJobRepository.existsByOriginalVideoKey(VALID_KEY)).willReturn(true);

        assertError(request(PLACE_LAT, PLACE_LNG), ErrorCode.VIDEO_ALREADY_REGISTERED);
    }

    @Test
    void 장소와_촬영_위치가_50m_이내면_통과한다() {
        // 위도 0.0003도 ≈ 33m (< 50m)
        ValidatedPinCreation result = service.validate(MEMBER_ID, request(PLACE_LAT + 0.0003, PLACE_LNG));

        assertThat(result.captureLatitude()).isEqualTo(PLACE_LAT + 0.0003);
    }

    @Test
    void 장소와_촬영_위치가_50m를_초과하면_LOCATION_OUT_OF_RANGE() {
        // 위도 0.001도 ≈ 111m (> 50m)
        assertError(request(PLACE_LAT + 0.001, PLACE_LNG), ErrorCode.LOCATION_OUT_OF_RANGE);
    }

    @Test
    void DB에_없는_장소는_Kakao로_확인해_거리_검증한다() {
        given(placeRepository.findFirstByKakaoPlaceId(KAKAO_PLACE_ID)).willReturn(Optional.empty());
        given(kakaoLocalClient.searchKeyword(anyString(), org.mockito.ArgumentMatchers.anyDouble(),
                org.mockito.ArgumentMatchers.anyDouble(), org.mockito.ArgumentMatchers.anyInt()))
                .willReturn(new KakaoKeywordResponse(List.of(
                        new KakaoKeywordResponse.Document(
                                KAKAO_PLACE_ID, "카카오 장소", "주소", "도로명", "02-000",
                                String.valueOf(PLACE_LNG), String.valueOf(PLACE_LAT), null))));

        ValidatedPinCreation result = service.validate(MEMBER_ID, request(PLACE_LAT, PLACE_LNG));

        assertThat(result.resolvedPlaceName()).isEqualTo("카카오 장소");
    }

    @Test
    void 지원하지_않는_crowdLevel이면_INVALID_CROWD_LEVEL() {
        PinCreateRequest request = request(VALID_KEY, "CROWDED", PLACE_LAT, PLACE_LNG, null);

        assertError(request, ErrorCode.INVALID_CROWD_LEVEL);
    }

    @Test
    void 일일_등록_제한을_초과하면_DAILY_PIN_LIMIT_EXCEEDED() {
        service = buildService(new PinRegistrationProperties(2)); // 하루 2개 제한
        given(pinRepository.countByMember_IdAndCreatedAtGreaterThanEqual(
                org.mockito.ArgumentMatchers.eq(MEMBER_ID), org.mockito.ArgumentMatchers.any()))
                .willReturn(2L);

        assertError(request(PLACE_LAT, PLACE_LNG), ErrorCode.DAILY_PIN_LIMIT_EXCEEDED);
    }

    @Test
    void 요청_바디가_없으면_INVALID_REQUEST() {
        assertError(null, ErrorCode.INVALID_REQUEST);
    }

    @Test
    void create는_검증_통과시_저장하고_발행한_뒤_pinId와_PENDING을_반환한다() {
        UUID pinId = UUID.fromString("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
        Pin savedPin = Pin.create(null, null, CrowdLevel.WAGLE,
                GF.createPoint(new Coordinate(PLACE_LNG, PLACE_LAT)), null, null, VALID_KEY, null);
        ReflectionTestUtils.setField(savedPin, "id", pinId);
        AiBlurJob savedJob = AiBlurJob.create(pinId, VALID_KEY, AiBlurJobType.INITIAL_UPLOAD);
        given(pinPersistenceService.save(any(ValidatedPinCreation.class)))
                .willReturn(new PinPersistenceService.Result(savedPin, savedJob));

        PinCreateResponse response = service.create(MEMBER_ID, request(PLACE_LAT, PLACE_LNG));

        assertThat(response.pinId()).isEqualTo(pinId);
        assertThat(response.videoStatus()).isEqualTo(VideoStatus.PENDING);
        // 커밋 이후 발행 경계로 저장된 AiBlurJob이 전달된다.
        verify(aiBlurJobPublisher).publishInitialUpload(savedJob);
    }

    @Test
    void create는_검증_실패시_저장도_발행도_하지_않는다() {
        PinCreateRequest invalid = request(VALID_KEY, "CROWDED", PLACE_LAT, PLACE_LNG, null);

        assertThatThrownBy(() -> service.create(MEMBER_ID, invalid))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.INVALID_CROWD_LEVEL);

        verify(pinPersistenceService, never()).save(any());
        verify(aiBlurJobPublisher, never()).publishInitialUpload(any());
    }

    private void assertError(PinCreateRequest request, ErrorCode expected) {
        assertThatThrownBy(() -> service.validate(MEMBER_ID, request))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(expected);
    }
}
