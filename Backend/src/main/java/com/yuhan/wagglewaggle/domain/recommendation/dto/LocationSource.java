package com.yuhan.wagglewaggle.domain.recommendation.dto;

/**
 * 추천에 적용한 위치 출처. 캐시에 저장하지 않고 이번 요청의 위치 결정 결과로 설정한다.
 * - CURRENT_GPS: 요청에 유효한 좌표가 전달되어 그 좌표를 사용한 경우
 * - CACHED_GPS: 요청 좌표가 없어 유효한 최근 GPS 캐시를 사용한 경우
 */
public enum LocationSource {
    CURRENT_GPS,
    CACHED_GPS
}
