package com.yuhan.wagglewaggle.domain.user.entity;

import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;

/**
 * 회원 연령대. 온보딩 요청의 ageGroup 문자열 enum과 1:1 대응한다.
 */
public enum AgeGroup {
    TEENS,
    TWENTIES,
    THIRTIES,
    FORTIES,
    FIFTIES,
    SIXTIES,
    SEVENTIES_AND_OVER;

    /**
     * 요청 문자열을 enum으로 변환한다. 허용되지 않는 값이면 INVALID_ONBOARDING_REQUEST.
     */
    public static AgeGroup from(String value) {
        if (value == null) {
            throw new CustomException(ErrorCode.INVALID_ONBOARDING_REQUEST);
        }
        try {
            return AgeGroup.valueOf(value);
        } catch (IllegalArgumentException e) {
            throw new CustomException(ErrorCode.INVALID_ONBOARDING_REQUEST);
        }
    }
}
