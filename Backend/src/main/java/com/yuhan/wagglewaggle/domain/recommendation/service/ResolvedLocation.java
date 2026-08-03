package com.yuhan.wagglewaggle.domain.recommendation.service;

import com.yuhan.wagglewaggle.domain.recommendation.dto.LocationSource;

/**
 * 위치 결정 결과. 추천 후보 조회에 적용할 좌표와 그 출처를 담는다.
 */
public record ResolvedLocation(
        double latitude,
        double longitude,
        LocationSource source
) {
}
