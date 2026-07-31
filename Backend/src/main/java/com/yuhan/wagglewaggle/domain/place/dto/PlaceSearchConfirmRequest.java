package com.yuhan.wagglewaggle.domain.place.dto;

/**
 * 장소 검색 확정 요청 Body.
 * 추천 검색어에서 선택한 장소명을 담으며, 카카오 키워드 조회·검색 이력에 사용한다.
 */
public record PlaceSearchConfirmRequest(
        String placeName
) {
}
