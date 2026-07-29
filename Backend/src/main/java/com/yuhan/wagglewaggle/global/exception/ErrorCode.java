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
    EXTERNAL_PLACE_API_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "외부 장소 검색 서비스를 사용할 수 없습니다."),

    // Tag
    INVALID_TAG_SEARCH_QUERY(HttpStatus.BAD_REQUEST, "태그 검색 조건이 올바르지 않습니다."),
    TAG_SEARCH_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "태그 검색 중 오류가 발생했습니다."),
    INVALID_COORDINATES(HttpStatus.BAD_REQUEST, "좌표가 올바르지 않습니다."),
    INVALID_RADIUS(HttpStatus.BAD_REQUEST, "반경이 올바르지 않습니다."),
    NEARBY_PLACES_FETCH_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "주변 장소 조회 중 오류가 발생했습니다."),

    // Auth
    AUTH_PROVIDER_INVALID(HttpStatus.BAD_REQUEST, "지원하지 않는 OAuth 제공자입니다."),
    INVALID_OAUTH_REQUEST(HttpStatus.BAD_REQUEST, "OAuth 요청 정보가 올바르지 않습니다."),
    AUTH_OAUTH_FAILED(HttpStatus.UNAUTHORIZED, "OAuth 인증에 실패했습니다."),
    AUTH_PROCESS_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "로그인 처리 중 오류가 발생했습니다."),

    // Token Refresh
    REFRESH_TOKEN_REQUIRED(HttpStatus.BAD_REQUEST, "리프레시 토큰이 필요합니다."),
    INVALID_REFRESH_TOKEN(HttpStatus.UNAUTHORIZED, "유효하지 않은 리프레시 토큰입니다."),
    REFRESH_TOKEN_REUSED(HttpStatus.UNAUTHORIZED, "리프레시 토큰 재사용이 감지되었습니다. 다시 로그인해 주세요."),
    TOKEN_REFRESH_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "토큰 재발급 중 오류가 발생했습니다."),

    // Onboarding
    INVALID_ONBOARDING_REQUEST(HttpStatus.BAD_REQUEST, "온보딩 입력값이 올바르지 않습니다."),
    INVALID_ONBOARDING_TOKEN(HttpStatus.UNAUTHORIZED, "온보딩 토큰이 유효하지 않습니다."),
    ONBOARDING_TOKEN_ALREADY_USED(HttpStatus.UNAUTHORIZED, "이미 사용된 온보딩 토큰입니다."),
    NICKNAME_ALREADY_EXISTS(HttpStatus.CONFLICT, "이미 사용 중인 닉네임입니다."),
    ONBOARDING_ALREADY_COMPLETED(HttpStatus.CONFLICT, "이미 온보딩을 완료한 사용자입니다."),
    ONBOARDING_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "온보딩 처리 중 오류가 발생했습니다.");

    private final HttpStatus status;
    private final String message;
}

