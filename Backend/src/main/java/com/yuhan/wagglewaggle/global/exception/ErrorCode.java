package com.yuhan.wagglewaggle.global.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

/**
 * 발생 가능한 ErrorCode 정의
 */
@Getter
@RequiredArgsConstructor
public enum ErrorCode {

    // Common
    INVALID_REQUEST(HttpStatus.BAD_REQUEST, "요청값이 올바르지 않습니다."),
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."),
    FORBIDDEN(HttpStatus.FORBIDDEN, "권한이 없습니다."),
    INTERNAL_SERVER_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "서버 내부 오류가 발생했습니다."),

    // Place
    INVALID_PLACE_SEARCH_QUERY(HttpStatus.BAD_REQUEST, "장소 검색 조건이 올바르지 않습니다."),
    EXTERNAL_PLACE_API_ERROR(HttpStatus.BAD_GATEWAY, "외부 장소 검색 API 오류가 발생했습니다."),
    EXTERNAL_PLACE_API_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "외부 장소 검색 서비스를 사용할 수 없습니다.");

    private final HttpStatus status;
    private final String message;
}

