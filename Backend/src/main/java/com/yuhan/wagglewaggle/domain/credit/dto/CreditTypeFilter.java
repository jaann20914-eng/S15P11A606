package com.yuhan.wagglewaggle.domain.credit.dto;

import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 크레딧 내역 조회 거래 유형 필터. 지원 값은 ALL, SPENT, EARNED 이며 기본값은 ALL 이다.
 * EARNED 는 amount 양수(적립), SPENT 는 amount 음수(사용) 거래만 포함한다.
 * amount 0 거래는 생성하지 않으므로 change_amount 부호로만 구분한다.
 * 잘못된 값은 기본값으로 보정하지 않고 INVALID_CREDIT_FILTER 예외를 던진다.
 */
@Getter
@RequiredArgsConstructor
public enum CreditTypeFilter {
    ALL(null, null),
    EARNED(1, null),
    SPENT(null, -1);

    /** change_amount 하한(포함). null 이면 하한 제한이 없다. */
    private final Integer minChangeAmount;
    /** change_amount 상한(포함). null 이면 상한 제한이 없다. */
    private final Integer maxChangeAmount;

    /**
     * 요청 type 문자열을 파싱한다. 값이 없으면(null/공백) 기본값 ALL 로 간주한다.
     */
    public static CreditTypeFilter from(String value) {
        if (value == null || value.isBlank()) {
            return ALL;
        }
        return switch (value.trim().toUpperCase()) {
            case "ALL" -> ALL;
            case "EARNED" -> EARNED;
            case "SPENT" -> SPENT;
            default -> throw new CustomException(ErrorCode.INVALID_CREDIT_FILTER);
        };
    }
}
