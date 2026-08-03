package com.yuhan.wagglewaggle.domain.recommendation.cache;

import com.yuhan.wagglewaggle.global.config.CacheConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * 추천 결과 캐시 저장소. 키는 (로직버전, 회원, 위치영역)이며 limit은 포함하지 않는다.
 * 위치영역은 좌표를 약 111m 격자(0.001도)로 양자화해, 같은 지점 근처의 반복 요청이 60초 내 캐시를 재사용하게 한다.
 * 캐시 장애는 서비스 실패로 전파하지 않는다: 조회 실패는 미스로 처리하고, 저장 실패는 무시한다(스펙).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RecommendationCacheStore {

    // 추천 로직 버전. 추천 알고리즘/후보 구성이 바뀌면 값을 올려 기존 캐시를 무효화한다.
    private static final int LOGIC_VERSION = 1;

    // 위치영역 격자 크기(도). 0.001도 ≈ 위도 111m.
    private static final double GRID_DEGREES = 0.001;

    private final CacheManager cacheManager;

    /** 동일 사용자·위치영역·로직버전이면 같은 키가 되도록 좌표를 격자 셀 인덱스로 양자화한다. */
    public String buildKey(long memberId, double latitude, double longitude) {
        long latCell = Math.round(latitude / GRID_DEGREES);
        long lngCell = Math.round(longitude / GRID_DEGREES);
        return "v" + LOGIC_VERSION + ":" + memberId + ":" + latCell + ":" + lngCell;
    }

    public Optional<RecommendationCacheEntry> find(String key) {
        try {
            Cache cache = cacheManager.getCache(CacheConfig.RECOMMENDATION_CACHE);
            if (cache == null) {
                return Optional.empty();
            }
            return Optional.ofNullable(cache.get(key, RecommendationCacheEntry.class));
        } catch (Exception e) {
            log.warn("추천 캐시 조회 실패 → 캐시 미스로 처리: {}", e.getMessage());
            return Optional.empty();
        }
    }

    public void save(String key, RecommendationCacheEntry entry) {
        try {
            Cache cache = cacheManager.getCache(CacheConfig.RECOMMENDATION_CACHE);
            if (cache != null) {
                cache.put(key, entry);
            }
        } catch (Exception e) {
            log.warn("추천 캐시 저장 실패 → 무시(결과는 정상 반환): {}", e.getMessage());
        }
    }
}
