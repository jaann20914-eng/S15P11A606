package com.yuhan.wagglewaggle.global.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

/**
 * 추천/GPS 캐시를 Caffeine(인메모리)으로 구성한다.
 * 캐시별 TTL이 달라 CaffeineCacheManager에 이름별 커스텀 스펙을 등록한다.
 * - recommendation: 추천 결과 캐시(TTL 60초). 동일 사용자·위치영역·로직버전 키로 AI 재호출을 막는다.
 * - gpsLocation: 최근 GPS 캐시(TTL 5분). 좌표 생략 요청에서 최근 위치를 재사용한다.
 * 단일 인스턴스 배포라 인메모리로 충분하며, 스케일아웃이 필요하면 이 빈만 Redis 기반으로 교체한다.
 */
@Configuration
@EnableCaching
public class CacheConfig {

    public static final String RECOMMENDATION_CACHE = "recommendation";
    public static final String GPS_LOCATION_CACHE = "gpsLocation";

    @Bean
    public CacheManager cacheManager() {
        CaffeineCacheManager cacheManager = new CaffeineCacheManager();
        cacheManager.setAllowNullValues(false);
        cacheManager.registerCustomCache(
                RECOMMENDATION_CACHE,
                Caffeine.newBuilder()
                        .expireAfterWrite(Duration.ofSeconds(60))
                        .maximumSize(10_000)
                        .build());
        cacheManager.registerCustomCache(
                GPS_LOCATION_CACHE,
                Caffeine.newBuilder()
                        .expireAfterWrite(Duration.ofMinutes(5))
                        .maximumSize(100_000)
                        .build());
        return cacheManager;
    }
}
