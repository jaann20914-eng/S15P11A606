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
        String keyword = normalizeKeyword(q, MAX_QUERY_LENGTH, true, ErrorCode.INVALID_TAG_SEARCH_QUERY);
        validateBounds(southWestLatitude, southWestLongitude, northEastLatitude, northEastLongitude,
                ErrorCode.INVALID_TAG_SEARCH_QUERY);
        return keyword;
    }

    /**
     * 태그/검색어를 정규화하고 검증한다.
     * 앞뒤 공백을 제거하고 선행 '#'을 제거한 뒤(→ 다시 공백 정리), toLowerCase가 true면 소문자화한다.
     * 정확 일치 검색처럼 대소문자를 유지해야 하면 toLowerCase를 false로 준다.
     * 빈 문자열이거나 maxLength를 초과하면 전달받은 errorCode로 예외를 던진다
     * (호출 API마다 길이·소문자화·오류 코드 정책이 다르므로 파라미터로 받는다).
     */
    public String normalizeKeyword(String q, int maxLength, boolean toLowerCase, ErrorCode errorCode) {
        if (q == null) {
            throw new CustomException(errorCode);
        }
        String keyword = q.trim();
        if (keyword.startsWith("#")) {
            keyword = keyword.substring(1).trim();
        }
        if (toLowerCase) {
            keyword = keyword.toLowerCase();
        }
        if (keyword.isEmpty() || keyword.length() > maxLength) {
            throw new CustomException(errorCode);
        }
        return keyword;
    }

    /**
     * 지도 경계 좌표의 범위(위도 -90~90 / 경도 -180~180)와 남서 < 북동 순서를 검증한다.
     * 위반 시 전달받은 errorCode로 예외를 던진다(호출 API마다 오류 코드가 다르므로 파라미터로 받는다).
     */
    public void validateBounds(
            double southWestLatitude, double southWestLongitude,
            double northEastLatitude, double northEastLongitude,
            ErrorCode errorCode) {
        boolean outOfRange = southWestLatitude < -90 || southWestLatitude > 90
                || northEastLatitude < -90 || northEastLatitude > 90
                || southWestLongitude < -180 || southWestLongitude > 180
                || northEastLongitude < -180 || northEastLongitude > 180;
        boolean invalidOrder = southWestLatitude >= northEastLatitude
                || southWestLongitude >= northEastLongitude;
        if (outOfRange || invalidOrder) {
            throw new CustomException(errorCode);
        }
    }
}
