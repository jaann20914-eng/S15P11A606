package com.yuhan.wagglewaggle.domain.recommendation.service;

import com.yuhan.wagglewaggle.domain.category.repository.CategoryPreferenceRepository;
import com.yuhan.wagglewaggle.domain.pin.entity.CrowdLevel;
import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import com.yuhan.wagglewaggle.domain.pin.entity.VideoStatus;
import com.yuhan.wagglewaggle.domain.pin.repository.PinRepository;
import com.yuhan.wagglewaggle.domain.pin.repository.PinUnlockRepository;
import com.yuhan.wagglewaggle.domain.place.entity.Place;
import com.yuhan.wagglewaggle.domain.place.entity.PlaceCategory;
import com.yuhan.wagglewaggle.domain.place.repository.PlaceRepository;
import com.yuhan.wagglewaggle.domain.recommendation.cache.RecommendationCacheEntry;
import com.yuhan.wagglewaggle.domain.recommendation.cache.RecommendationCacheStore;
import com.yuhan.wagglewaggle.domain.recommendation.client.AiRecommendationClient;
import com.yuhan.wagglewaggle.domain.recommendation.client.dto.ScoreResponse;
import com.yuhan.wagglewaggle.domain.recommendation.client.dto.ScoredPlace;
import com.yuhan.wagglewaggle.domain.recommendation.dto.LocationSource;
import com.yuhan.wagglewaggle.domain.recommendation.dto.RecommendationResponse;
import com.yuhan.wagglewaggle.domain.user.entity.AgeGroup;
import com.yuhan.wagglewaggle.domain.user.entity.Gender;
import com.yuhan.wagglewaggle.domain.user.entity.Member;
import com.yuhan.wagglewaggle.global.config.CacheConfig;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import com.yuhan.wagglewaggle.domain.recommendation.cache.GpsLocationCacheStore;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.PrecisionModel;
import org.springframework.cache.CacheManager;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * 추천 오케스트레이션(RecommendationService)을 검증한다.
 * 리포지토리·AI 클라이언트는 목(mock)이고, 캐시/위치/조립기는 실제 객체를 조립해 흐름을 확인한다.
 */
class RecommendationServiceTest {

    private static final GeometryFactory GF = new GeometryFactory(new PrecisionModel(), 4326);
    private static final long MEMBER_ID = 7L;
    private static final long PLACE_ID = 1L;
    private static final double LAT = 37.5006;
    private static final double LNG = 127.0364;

    private PlaceRepository placeRepository;
    private PinRepository pinRepository;
    private PinUnlockRepository pinUnlockRepository;
    private CategoryPreferenceRepository categoryPreferenceRepository;
    private AiRecommendationClient aiRecommendationClient;
    private RecommendationCacheStore recommendationCacheStore;

    private RecommendationService service;

    private Member author;
    private Place place;
    private Pin pin;

    @BeforeEach
    void setUp() {
        placeRepository = mock(PlaceRepository.class);
        pinRepository = mock(PinRepository.class);
        pinUnlockRepository = mock(PinUnlockRepository.class);
        categoryPreferenceRepository = mock(CategoryPreferenceRepository.class);
        aiRecommendationClient = mock(AiRecommendationClient.class);
        var memberRepository = mock(com.yuhan.wagglewaggle.domain.user.repository.MemberRepository.class);

        CacheManager cacheManager = new CacheConfig().cacheManager();
        recommendationCacheStore = new RecommendationCacheStore(cacheManager);
        LocationResolver locationResolver = new LocationResolver(new GpsLocationCacheStore(cacheManager));

        service = new RecommendationService(
                placeRepository, pinRepository, pinUnlockRepository, memberRepository,
                categoryPreferenceRepository, locationResolver, recommendationCacheStore,
                new AiCandidateAssembler(), aiRecommendationClient, new RecommendationResponseAssembler());

        author = Member.create("author", AgeGroup.TWENTIES, Gender.FEMALE);
        ReflectionTestUtils.setField(author, "id", 100L);
        place = Place.create("kakao-1", "성수 카페", GF.createPoint(new Coordinate(LNG, LAT)),
                PlaceCategory.CAFE, "CE7", "음식점 > 카페", "음식점 > 카페", "", "서울 성동구");
        ReflectionTestUtils.setField(place, "id", PLACE_ID);
        pin = Pin.create(author, place, CrowdLevel.RELAXED,
                GF.createPoint(new Coordinate(LNG, LAT)), "2층", "메모", "pins/original/100/" + UUID.randomUUID() + ".mp4",
                Instant.now().plus(Duration.ofMinutes(30)));
        ReflectionTestUtils.setField(pin, "id", UUID.randomUUID());
        ReflectionTestUtils.setField(pin, "videoStatus", VideoStatus.ACTIVE);

        given(memberRepository.findById(MEMBER_ID)).willReturn(java.util.Optional.of(author));
    }

    @Test
    @DisplayName("캐시 미스: 후보를 AI에 넘겨 받은 순서로 카드를 조립하고 CURRENT_GPS로 응답한다")
    void recommend_cacheMiss_callsAiAndAssembles() {
        given(placeRepository.findCandidatePlaceIds(anyDouble(), anyDouble(), anyDouble(), any()))
                .willReturn(List.of(PLACE_ID));
        given(pinRepository.findActivePinsByPlaceIdIn(any(), any())).willReturn(List.of(pin));
        given(placeRepository.findAllById(any())).willReturn(List.of(place));
        given(pinUnlockRepository.countByPlaceSince(any(), any())).willReturn(List.of());
        given(categoryPreferenceRepository.findPreferredCategoryCodes(MEMBER_ID)).willReturn(List.of("CAFE"));
        given(aiRecommendationClient.score(any())).willReturn(new ScoreResponse(
                List.of(new ScoredPlace(PLACE_ID, pin.getId(), 0.9)), List.of(), "2026-08-04T10:00:00+09:00"));

        RecommendationResponse response = service.recommend(MEMBER_ID, LAT, LNG, 5);

        verify(aiRecommendationClient).score(any());
        assertThat(response.locationSource()).isEqualTo(LocationSource.CURRENT_GPS);
        assertThat(response.recommendations().relaxed()).hasSize(1);
        assertThat(response.recommendations().wagle()).isEmpty();

        var card = response.recommendations().relaxed().get(0);
        assertThat(card.placeId()).isEqualTo(PLACE_ID);
        assertThat(card.phone()).isNull(); // 빈 문자열 → null
        assertThat(card.representativeUploaderNickname()).isEqualTo("author");
        assertThat(card.activePinCount()).isEqualTo(1);
        assertThat(card.uploaderCount()).isEqualTo(1);
        assertThat(card.pinPreviews()).hasSize(1);
        assertThat(card.pinPreviews().get(0).pinId()).isEqualTo(pin.getId());
    }

    @Test
    @DisplayName("캐시 적중: AI를 호출하지 않고 저장된 generatedAt을 반환한다")
    void recommend_cacheHit_skipsAi() {
        OffsetDateTime cachedGeneratedAt = OffsetDateTime.of(2026, 8, 4, 9, 0, 0, 0, ZoneOffset.ofHours(9));
        String key = recommendationCacheStore.buildKey(MEMBER_ID, LAT, LNG);
        recommendationCacheStore.save(key, new RecommendationCacheEntry(
                List.of(new RecommendationCacheEntry.CachedPlace(PLACE_ID, pin.getId())), List.of(), cachedGeneratedAt));

        given(pinRepository.findActivePinsByPlaceIdIn(any(), any())).willReturn(List.of(pin));
        given(placeRepository.findAllById(any())).willReturn(List.of(place));

        RecommendationResponse response = service.recommend(MEMBER_ID, LAT, LNG, 5);

        verify(aiRecommendationClient, never()).score(any());
        verify(placeRepository, never()).findCandidatePlaceIds(anyDouble(), anyDouble(), anyDouble(), any());
        assertThat(response.generatedAt()).isEqualTo(cachedGeneratedAt);
        assertThat(response.recommendations().relaxed()).hasSize(1);
    }

    @Test
    @DisplayName("후보가 0개면 AI를 호출하지 않고 빈 배열을 반환한다")
    void recommend_noCandidates_returnsEmpty() {
        given(placeRepository.findCandidatePlaceIds(anyDouble(), anyDouble(), anyDouble(), any()))
                .willReturn(List.of());

        RecommendationResponse response = service.recommend(MEMBER_ID, LAT, LNG, 5);

        verify(aiRecommendationClient, never()).score(any());
        assertThat(response.recommendations().relaxed()).isEmpty();
        assertThat(response.recommendations().wagle()).isEmpty();
    }

    @Test
    @DisplayName("AI 실패는 AI_RECOMMENDATION_FAILED로 전파된다")
    void recommend_aiFailure_propagates() {
        given(placeRepository.findCandidatePlaceIds(anyDouble(), anyDouble(), anyDouble(), any()))
                .willReturn(List.of(PLACE_ID));
        given(pinRepository.findActivePinsByPlaceIdIn(any(), any())).willReturn(List.of(pin));
        given(placeRepository.findAllById(any())).willReturn(List.of(place));
        given(pinUnlockRepository.countByPlaceSince(any(), any())).willReturn(List.of());
        given(categoryPreferenceRepository.findPreferredCategoryCodes(MEMBER_ID)).willReturn(List.of("CAFE"));
        given(aiRecommendationClient.score(any())).willThrow(new CustomException(ErrorCode.AI_RECOMMENDATION_FAILED));

        assertThatThrownBy(() -> service.recommend(MEMBER_ID, LAT, LNG, 5))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.AI_RECOMMENDATION_FAILED);
    }
}
