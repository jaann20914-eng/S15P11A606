package com.yuhan.wagglewaggle.domain.credit.dto;

import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 크레딧 내역 조회 기간 필터. 지원 값은 ALL, TODAY, WEEK, MONTH 이며 기본값은 ALL 이다.
 * 기간은 거래 createdAt 을 서비스 날짜(Asia/Seoul 매일 04시 경계)로 변환해 적용한다.
 * TODAY=현재 서비스 날짜 1일, WEEK=현재 포함 최근 7 서비스 날짜, MONTH=현재 포함 최근 30 서비스 날짜다.
 * ALL 은 기간 제한이 없다(serviceDays=null).
 * 잘못된 값은 기본값으로 보정하지 않고 INVALID_CREDIT_FILTER 예외를 던진다.
 */
@Getter
@RequiredArgsConstructor
public enum CreditPeriodFilter {
    ALL(null),
    TODAY(1),
    WEEK(7),
    MONTH(30);

    /** 현재 서비스 날짜를 포함해 조회할 서비스 날짜 수. null 이면 기간 제한이 없다. */
    private final Integer serviceDays;

    /**
     * 요청 period 문자열을 파싱한다. 값이 없으면(null/공백) 기본값 ALL 로 간주한다.
     */
    public static CreditPeriodFilter from(String value) {
        if (value == null || value.isBlank()) {
            return ALL;
        }
        return switch (value.trim().toUpperCase()) {
            case "ALL" -> ALL;
            case "TODAY" -> TODAY;
            case "WEEK" -> WEEK;
            case "MONTH" -> MONTH;
            default -> throw new CustomException(ErrorCode.INVALID_CREDIT_FILTER);
        };
    }
}
