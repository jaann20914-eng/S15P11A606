package com.yuhan.wagglewaggle.domain.place.dto;

import java.util.List;

/**
 * 장소 키워드 검색 응답의 data 래퍼.
 */
public record PlaceSearchResponse(
        List<PlaceSearchResult> places
) {
}
