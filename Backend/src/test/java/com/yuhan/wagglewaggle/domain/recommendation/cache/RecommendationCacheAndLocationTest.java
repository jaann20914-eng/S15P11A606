package com.yuhan.wagglewaggle.domain.recommendation.cache;

import com.yuhan.wagglewaggle.domain.recommendation.dto.LocationSource;
import com.yuhan.wagglewaggle.domain.recommendation.service.LocationResolver;
import com.yuhan.wagglewaggle.domain.recommendation.service.ResolvedLocation;
import com.yuhan.wagglewaggle.global.config.CacheConfig;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.cache.CacheManager;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * 위치 결정 로직과 캐시 스토어를 실제 CaffeineCacheManager(CacheConfig) 위에서 검증한다.
 * Spring 컨텍스트나 외부 인프라 없이 수동 조립한다.
 */
class RecommendationCacheAndLocationTest {

    private static final long MEMBER_ID = 42L;
    private static final double LAT = 37.5006;
    private static final double LNG = 127.0364;

    private GpsLocationCacheStore gpsStore;
    private RecommendationCacheStore recommendationStore;
    private LocationResolver resolver;

    @BeforeEach
    void setUp() {
        CacheManager cacheManager = new CacheConfig().cacheManager();
        gpsStore = new GpsLocationCacheStore(cacheManager);
        recommendationStore = new RecommendationCacheStore(cacheManager);
        resolver = new LocationResolver(gpsStore);
    }

    @Test
    @DisplayName("좌표가 둘 다 오면 CURRENT_GPS이며 GPS 캐시에 저장된다")
    void resolve_withCoordinates_currentGpsAndCached() {
        ResolvedLocation resolved = resolver.resolve(MEMBER_ID, LAT, LNG);

        assertThat(resolved.source()).isEqualTo(LocationSource.CURRENT_GPS);
        assertThat(resolved.latitude()).isEqualTo(LAT);
        assertThat(resolved.longitude()).isEqualTo(LNG);
        // 저장 확인
        Optional<GpsLocation> cached = gpsStore.find(MEMBER_ID);
        assertThat(cached).isPresent();
        assertThat(cached.get().latitude()).isEqualTo(LAT);
    }

    @Test
    @DisplayName("좌표 생략 + 유효 GPS 캐시가 있으면 CACHED_GPS로 그 좌표를 쓴다")
    void resolve_withoutCoordinates_usesCache() {
        gpsStore.save(MEMBER_ID, new GpsLocation(LAT, LNG, Instant.now()));

        ResolvedLocation resolved = resolver.resolve(MEMBER_ID, null, null);

        assertThat(resolved.source()).isEqualTo(LocationSource.CACHED_GPS);
        assertThat(resolved.latitude()).isEqualTo(LAT);
        assertThat(resolved.longitude()).isEqualTo(LNG);
    }

    @Test
    @DisplayName("좌표 생략 + GPS 캐시 없음이면 LOCATION_NOT_AVAILABLE")
    void resolve_withoutCoordinates_noCache_throws() {
        assertThatThrownBy(() -> resolver.resolve(MEMBER_ID, null, null))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.LOCATION_NOT_AVAILABLE);
    }

    @Test
    @DisplayName("좌표 한쪽만 오거나 범위를 벗어나면 INVALID_LOCATION")
    void resolve_invalidCoordinates_throws() {
        assertThatThrownBy(() -> resolver.resolve(MEMBER_ID, LAT, null))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.INVALID_LOCATION);

        assertThatThrownBy(() -> resolver.resolve(MEMBER_ID, 91.0, LNG))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.INVALID_LOCATION);

        assertThatThrownBy(() -> resolver.resolve(MEMBER_ID, LAT, 181.0))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.INVALID_LOCATION);
    }

    @Test
    @DisplayName("추천 캐시 키는 같은 위치영역이면 동일하고, 셀이 다르면 달라진다")
    void buildKey_isStablePerAreaCell() {
        // 격자(0.001도) 셀 중심 부근 좌표를 써서 경계 반올림 영향을 피한다.
        double centerLat = 37.5000;
        double centerLng = 127.0360;
        String key = recommendationStore.buildKey(MEMBER_ID, centerLat, centerLng);

        // 같은 111m 격자 셀 내 미세 이동 → 같은 키
        assertThat(recommendationStore.buildKey(MEMBER_ID, centerLat + 0.0003, centerLng + 0.0003)).isEqualTo(key);
        // 다른 셀 → 다른 키
        assertThat(recommendationStore.buildKey(MEMBER_ID, centerLat + 0.01, centerLng)).isNotEqualTo(key);
        // 다른 회원 → 다른 키
        assertThat(recommendationStore.buildKey(MEMBER_ID + 1, centerLat, centerLng)).isNotEqualTo(key);
    }

    @Test
    @DisplayName("추천 캐시는 저장 후 같은 키로 조회되고, 없는 키는 미스다")
    void recommendationCache_saveAndFind() {
        String key = recommendationStore.buildKey(MEMBER_ID, LAT, LNG);
        OffsetDateTime generatedAt = OffsetDateTime.of(2026, 8, 3, 10, 0, 0, 0, ZoneOffset.ofHours(9));
        RecommendationCacheEntry entry = new RecommendationCacheEntry(
                List.of(new RecommendationCacheEntry.CachedPlace(1L, UUID.randomUUID())),
                List.of(new RecommendationCacheEntry.CachedPlace(2L, UUID.randomUUID())),
                generatedAt);

        recommendationStore.save(key, entry);

        Optional<RecommendationCacheEntry> found = recommendationStore.find(key);
        assertThat(found).isPresent();
        assertThat(found.get().generatedAt()).isEqualTo(generatedAt);
        assertThat(found.get().relaxed()).hasSize(1);

        assertThat(recommendationStore.find("v1:999:0:0")).isEmpty();
    }
}
