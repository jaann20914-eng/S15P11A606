package com.yuhan.wagglewaggle.domain.pin.tag.service;

import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import org.springframework.stereotype.Component;

@Component
public class TagQueryNormalizer {

    private static final int MAX_QUERY_LENGTH = 50;

    // 검색어를 색인 정규화 규칙과 동일하게 다듬고(공백 제거 → 선행 # 제거 → 소문자)
    // 빈값/길이/지도 경계 좌표를 검증한다. 위반 시 INVALID_TAG_SEARCH_QUERY.
    public String normalizeAndValidate(
            String q,
            double southWestLatitude, double southWestLongitude,
            double northEastLatitude, double northEastLongitude) {
        if (q == null) {
            throw new CustomException(ErrorCode.INVALID_TAG_SEARCH_QUERY);
        }
        String keyword = q.trim();
        if (keyword.startsWith("#")) {
            keyword = keyword.substring(1).trim();
        }
        keyword = keyword.toLowerCase();

        boolean outOfRange = southWestLatitude < -90 || southWestLatitude > 90
                || northEastLatitude < -90 || northEastLatitude > 90
                || southWestLongitude < -180 || southWestLongitude > 180
                || northEastLongitude < -180 || northEastLongitude > 180;
        boolean invalidOrder = southWestLatitude >= northEastLatitude || southWestLongitude >= northEastLongitude;
        if (keyword.isEmpty() || keyword.length() > MAX_QUERY_LENGTH || outOfRange || invalidOrder) {
            throw new CustomException(ErrorCode.INVALID_TAG_SEARCH_QUERY);
        }
        return keyword;
    }
}
