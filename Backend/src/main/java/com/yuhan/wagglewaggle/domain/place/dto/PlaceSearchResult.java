package com.yuhan.wagglewaggle.domain.place.dto;

/**
 * 장소 키워드 검색 결과 항목.
 */
public record PlaceSearchResult(
        String kakaoPlaceId,
        String name,
        String address,
        double latitude,
        double longitude,
        int distanceMeters
) {
}
