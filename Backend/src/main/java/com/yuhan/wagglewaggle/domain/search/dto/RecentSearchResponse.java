package com.yuhan.wagglewaggle.domain.search.dto;

import com.yuhan.wagglewaggle.domain.search.entity.SearchType;

import java.time.Instant;

/**
 * 최근 검색기록 단건 응답.
 * PLACE 검색이면 placeId, kakaoPlaceId를 채우고 TAG 검색이면 둘 다 null이다.
 * createdAt은 UTC 기준 ISO-8601로 전달하고 timezone 변환은 클라이언트가 처리한다.
 */
public record RecentSearchResponse(
        Long searchId,
        SearchType type,
        String keyword,
        Long placeId,
        String kakaoPlaceId,
        Instant createdAt
) {
}
