package com.yuhan.wagglewaggle.domain.place.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;

/**
 * 카카오 로컬 키워드 검색(keyword.json)·카테고리 검색(category.json) 공통 응답 매핑 DTO.
 * 두 API의 document 구조가 동일하므로 재사용한다.
 * x=경도 / y=위도 / distance=미터(문자열, x·y 좌표를 넘긴 경우에만 포함).
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record KakaoKeywordResponse(
        List<Document> documents
) {

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Document(
            String id,
            @JsonProperty("place_name") String placeName,
            @JsonProperty("address_name") String addressName,
            @JsonProperty("road_address_name") String roadAddressName,
            @JsonProperty("category_group_code") String categoryGroupCode,
            @JsonProperty("category_group_name") String categoryGroupName,
            @JsonProperty("category_name") String categoryName,
            String phone,
            String x,
            String y,
            String distance
    ) {
    }
}
