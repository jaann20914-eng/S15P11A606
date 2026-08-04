package com.yuhan.wagglewaggle.domain.place.dto;

import java.util.List;

/**
 * 반경 50m 내 장소 조회 응답의 data 래퍼.
 */
public record PlaceNearbyResponse(
        List<PlaceNearbyItem> places
) {
}
