package com.yuhan.wagglewaggle.domain.place.dto;

import java.util.List;

/**
 * 지도 범위 내 장소 목록 조회 응답의 data 래퍼.
 */
public record PlaceListResponse(
        List<PlaceListItem> places
) {
}
