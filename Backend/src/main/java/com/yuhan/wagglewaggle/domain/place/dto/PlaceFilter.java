package com.yuhan.wagglewaggle.domain.place.dto;

import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;

/**
 * 지도 장소 조회 혼잡도 필터. 지원 값은 wagle, relaxed 뿐이다.
 * 잘못된 값은 기본값으로 보정하지 않고 INVALID_PLACE_FILTER 예외를 던진다.
 */
public enum PlaceFilter {
    WAGLE,
    RELAXED;

    /**
     * 요청 filter 문자열을 파싱한다. 값이 없으면(null/공백) 필터 미적용(null)으로 간주한다.
     */
    public static PlaceFilter from(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return switch (value.trim().toLowerCase()) {
            case "wagle" -> WAGLE;
            case "relaxed" -> RELAXED;
            default -> throw new CustomException(ErrorCode.INVALID_PLACE_FILTER);
        };
    }
}
