package com.yuhan.wagglewaggle.domain.place.dto;

import java.util.List;

/**
 * 지도 범위 내 장소 목록 응답 항목.
 * averageCrowdLevel/crowdLabel은 집계 가능한 유효 핀이 없으면 둘 다 null이다.
 */
public record PlaceListItem(
        Long placeId,
        String name,
        String address,
        String phone,
        double latitude,
        double longitude,
        Double averageCrowdLevel,
        String crowdLabel,
        List<ActivePinResponse> activePins
) {
}
