package com.yuhan.wagglewaggle.domain.place.dto;

import java.util.List;

/**
 * 장소 홈(장소 상세) 조회 응답.
 */
public record PlaceDetailResponse(
        PlaceInfo place, // 장소 기본 정보
        List<PinCard> pins, // 활성 핀 카드 리스트
        List<WeeklyCrowdStat> weeklyCrowdStats // 요일별 혼잡도 통계
) {
}
