package com.yuhan.wagglewaggle.domain.place.dto;

/**
 * 반경 내 주변 장소 응답 항목.
 * distanceMeters(미터) 오름차순으로 정렬되어 반환된다.
 */
public record NearbyPlaceSearchResponse(
        Long kakaoPlaceId,
        String name,
        String address,
        double latitude,
        double longitude,
        double distanceMeters
) {
}
