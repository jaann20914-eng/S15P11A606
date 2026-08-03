package com.yuhan.wagglewaggle.domain.recommendation.cache;

import com.yuhan.wagglewaggle.global.config.CacheConfig;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * 최근 GPS 캐시 저장소(회원 단위). Spring Cache 추상화 위에서 동작하므로 백엔드(Caffeine→Redis) 교체가 자유롭다.
 * 조회 오류는 삼키지 않고 전파한다(호출부가 RECOMMENDATION_FETCH_FAILED로 매핑).
 * 유효시간(5분)은 캐시 TTL로 강제되므로, 조회 결과가 존재하면 유효한 값이다.
 */
@Component
@RequiredArgsConstructor
public class GpsLocationCacheStore {

    private final CacheManager cacheManager;

    public Optional<GpsLocation> find(Long memberId) {
        return Optional.ofNullable(cache().get(memberId, GpsLocation.class));
    }

    public void save(Long memberId, GpsLocation location) {
        cache().put(memberId, location);
    }

    private Cache cache() {
        Cache cache = cacheManager.getCache(CacheConfig.GPS_LOCATION_CACHE);
        if (cache == null) {
            throw new IllegalStateException("gpsLocation 캐시가 구성되지 않았습니다.");
        }
        return cache;
    }
}
