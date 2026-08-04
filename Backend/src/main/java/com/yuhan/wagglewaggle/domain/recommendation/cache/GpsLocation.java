package com.yuhan.wagglewaggle.domain.recommendation.cache;

import java.time.Instant;

/**
 * 최근 GPS 캐시 값. 좌표와 저장 시각을 담는다.
 * 유효시간(5분)은 캐시 TTL(expireAfterWrite)로 강제되므로, 조회되면 유효한 값이다.
 */
public record GpsLocation(
        double latitude,
        double longitude,
        Instant savedAt
) {
}
