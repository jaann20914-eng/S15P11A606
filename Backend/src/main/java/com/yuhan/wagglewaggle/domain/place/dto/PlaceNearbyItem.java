package com.yuhan.wagglewaggle.domain.place.dto;

/**
 * 반경 50m 내 장소 후보 항목.
 * 모든 필드는 카카오 Local API에서 받은 값이며, 프론트엔드가 저장해 두었다가 핀 등록 시 사용한다.
 * addressName은 지번 주소(address_name)를 반환한다.
 */
public record PlaceNearbyItem(
        String kakaoPlaceId,
        String placeName,
        double kakaoPlaceLatitude,
        double kakaoPlaceLongitude,
        String categoryGroupCode,
        String categoryGroupName,
        String categoryName,
        String phone,
        String addressName,
        int distanceMeters
) {
}
