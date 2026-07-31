package com.yuhan.wagglewaggle.domain.place.dto;

/**
 * 장소 홈 상단의 장소 기본 정보. 주소·전화번호는 카카오 로컬 API에서 실시간으로 채운다.
 */
public record PlaceInfo(
        Long placeId,
        String name,
        String address,
        String phone
) {
}
