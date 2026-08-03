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
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "인증이 필요합니다."),
    FORBIDDEN(HttpStatus.FORBIDDEN, "권한이 없습니다."),
    INTERNAL_SERVER_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "서버 내부 오류가 발생했습니다."),

    // Internal API (AI Worker 등 내부 시스템 콜백)
    INTERNAL_UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "내부 API 인증에 실패했습니다."),

    // Place
    INVALID_PLACE_SEARCH_QUERY(HttpStatus.BAD_REQUEST, "장소 검색 조건이 올바르지 않습니다."),
    EXTERNAL_PLACE_API_ERROR(HttpStatus.BAD_GATEWAY, "외부 장소 검색 API 오류가 발생했습니다."),
    EXTERNAL_PLACE_API_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "외부 장소 검색 서비스를 사용할 수 없습니다."),
    INVALID_MAP_RANGE(HttpStatus.BAD_REQUEST, "지도 조회 범위가 올바르지 않습니다."),
    INVALID_PLACE_FILTER(HttpStatus.BAD_REQUEST, "지원하지 않는 장소 필터입니다."),
    PLACES_FETCH_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "장소 목록 조회 중 오류가 발생했습니다."),
    INVALID_PLACE_ID(HttpStatus.BAD_REQUEST, "유효하지 않은 장소 ID입니다."),
    PLACE_NOT_FOUND(HttpStatus.NOT_FOUND, "장소를 찾을 수 없습니다."),
    PLACE_DETAIL_FETCH_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "장소 상세 조회 중 오류가 발생했습니다."),

    // Tag
    INVALID_TAG_SEARCH_QUERY(HttpStatus.BAD_REQUEST, "태그 검색 조건이 올바르지 않습니다."),
    TAG_SEARCH_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "태그 검색 중 오류가 발생했습니다."),
    INVALID_TAG_NAME(HttpStatus.BAD_REQUEST, "태그명이 올바르지 않습니다."),
    TAGGED_PINS_FETCH_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "태그가 포함된 핀 목록 조회 중 오류가 발생했습니다."),
    INVALID_COORDINATES(HttpStatus.BAD_REQUEST, "좌표가 올바르지 않습니다."),
    INVALID_RADIUS(HttpStatus.BAD_REQUEST, "반경이 올바르지 않습니다."),
    NEARBY_PLACES_FETCH_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "주변 장소 조회 중 오류가 발생했습니다."),

    // Search History
    INVALID_LIMIT(HttpStatus.BAD_REQUEST, "조회 개수가 올바르지 않습니다."),
    RECENT_SEARCHES_FETCH_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "최근 검색기록 조회 중 오류가 발생했습니다."),

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

    // User
    INVALID_NICKNAME(HttpStatus.BAD_REQUEST, "닉네임 형식이 올바르지 않습니다."),
    NICKNAME_AVAILABILITY_CHECK_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "닉네임 중복 확인 중 오류가 발생했습니다."),
    NICKNAME_UPDATE_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "닉네임 수정 중 오류가 발생했습니다."),

    // User Profile
    // UNAUTHORIZED(401)는 위 Common 정의를 재사용한다.
    INVALID_YEAR_MONTH(HttpStatus.BAD_REQUEST, "조회 연월이 올바르지 않습니다."),
    USER_NOT_FOUND(HttpStatus.NOT_FOUND, "사용자 정보를 찾을 수 없습니다."),
    USER_PROFILE_FETCH_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "내 프로필 및 활동 요약 조회 중 오류가 발생했습니다."),

    // Onboarding
    INVALID_ONBOARDING_REQUEST(HttpStatus.BAD_REQUEST, "온보딩 입력값이 올바르지 않습니다."),
    INVALID_ONBOARDING_TOKEN(HttpStatus.UNAUTHORIZED, "온보딩 토큰이 유효하지 않습니다."),
    ONBOARDING_TOKEN_ALREADY_USED(HttpStatus.UNAUTHORIZED, "이미 사용된 온보딩 토큰입니다."),
    NICKNAME_ALREADY_EXISTS(HttpStatus.CONFLICT, "이미 사용 중인 닉네임입니다."),
    ONBOARDING_ALREADY_COMPLETED(HttpStatus.CONFLICT, "이미 온보딩을 완료한 사용자입니다."),
    ONBOARDING_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "온보딩 처리 중 오류가 발생했습니다."),

    // Pin Upload
    INVALID_UPLOAD_REQUEST(HttpStatus.BAD_REQUEST, "영상 업로드 정보 발급 요청이 올바르지 않습니다."),
    UPLOAD_URL_ISSUE_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "영상 업로드 정보 발급 중 오류가 발생했습니다."),

    // Pin Create
    INVALID_CROWD_LEVEL(HttpStatus.BAD_REQUEST, "허용되지 않은 혼잡 단계입니다."),
    VIDEO_ALREADY_REGISTERED(HttpStatus.CONFLICT, "이미 사용된 영상입니다."),
    LOCATION_OUT_OF_RANGE(HttpStatus.UNPROCESSABLE_CONTENT, "장소와 촬영 위치가 너무 멉니다."),
    VIDEO_NOT_ACCESSIBLE(HttpStatus.UNPROCESSABLE_CONTENT, "영상을 확인할 수 없습니다."),
    DAILY_PIN_LIMIT_EXCEEDED(HttpStatus.TOO_MANY_REQUESTS, "오늘 등록할 수 있는 핀 개수를 초과했습니다."),
    PIN_CREATE_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "핀 등록 처리 중 오류가 발생했습니다."),

    // AI Blur Result
    INVALID_AI_BLUR_RESULT(HttpStatus.BAD_REQUEST, "AI 블러 결과 메시지 형식이 올바르지 않습니다."),
    AI_BLUR_PIN_NOT_FOUND(HttpStatus.INTERNAL_SERVER_ERROR, "AI 블러 대상 핀을 찾을 수 없습니다."),

    // Pin Status
    PIN_NOT_FOUND(HttpStatus.NOT_FOUND, "조회할 수 있는 핀이 없습니다."),
    PIN_STATUS_READ_FORBIDDEN(HttpStatus.FORBIDDEN, "해당 핀의 처리 상태를 조회할 권한이 없습니다."),
    PIN_STATUS_READ_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "핀 상태 조회 중 오류가 발생했습니다."),

    // Pin Detail
    INVALID_PIN_ID(HttpStatus.BAD_REQUEST, "핀 ID 형식이 올바르지 않습니다."),
    PIN_DETAIL_FETCH_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "영상 핀 상세 조회 중 오류가 발생했습니다."),
    MEDIA_URL_ISSUE_FAILED(HttpStatus.SERVICE_UNAVAILABLE, "영상 미디어 URL 발급에 실패했습니다."),

    // Chat
    CHAT_REQUEST_FORBIDDEN(HttpStatus.FORBIDDEN, "채팅을 요청할 수 없습니다."),
    CHAT_REQUEST_ALREADY_EXISTS(HttpStatus.CONFLICT, "이미 대기 중인 요청 또는 채팅방이 있습니다."),
    CHAT_REQUEST_CREATE_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "채팅 요청 처리 중 오류가 발생했습니다."),

    // Chat Request Decision
    INVALID_CHAT_DECISION(HttpStatus.BAD_REQUEST, "채팅 요청 결정 값이 올바르지 않습니다."),
    CHAT_REQUEST_DECISION_FORBIDDEN(HttpStatus.FORBIDDEN, "채팅 요청에 응답할 권한이 없습니다."),
    CHAT_REQUEST_NOT_FOUND(HttpStatus.NOT_FOUND, "채팅 요청을 찾을 수 없습니다."),
    CHAT_REQUEST_ALREADY_DECIDED(HttpStatus.CONFLICT, "이미 처리된 채팅 요청입니다."),
    INSUFFICIENT_CREDIT(HttpStatus.CONFLICT, "크레딧 잔액이 부족합니다."),
    CHAT_REQUEST_DECISION_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "채팅 요청 응답 처리 중 오류가 발생했습니다."),

    // Pin Update
    INVALID_PIN_UPDATE_REQUEST(HttpStatus.BAD_REQUEST, "핀 수정 요청값이 올바르지 않습니다."),
    PIN_UPDATE_FORBIDDEN(HttpStatus.FORBIDDEN, "핀을 수정할 권한이 없습니다."),
    PIN_NOT_EDITABLE(HttpStatus.CONFLICT, "수정할 수 없는 상태의 핀입니다."),
    PIN_UPDATE_IN_PROGRESS(HttpStatus.CONFLICT, "이미 진행 중인 영상 교체 작업이 있습니다."),
    PIN_UPDATE_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "핀 수정 처리 중 오류가 발생했습니다."),

    // Pin Delete
    PIN_DELETE_FORBIDDEN(HttpStatus.FORBIDDEN, "핀을 삭제할 권한이 없습니다."),
    PIN_DELETE_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "영상 핀 삭제 중 오류가 발생했습니다."),

    // WebSocket / Chat Realtime
    // WebSocket은 REST 공통 응답을 쓰지 않고 STOMP ERROR 프레임/SUBSCRIPTION_FAILED 이벤트에 code만 실어 전달한다.
    // status는 규약 통일을 위해 유지하되, 실제 전송 본문에는 name()과 message만 사용한다.
    WEBSOCKET_UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "WebSocket 인증에 실패했습니다."),
    WEBSOCKET_TOKEN_EXPIRED(HttpStatus.UNAUTHORIZED, "WebSocket 인증 토큰이 만료되었습니다."),
    UNSUPPORTED_STOMP_VERSION(HttpStatus.BAD_REQUEST, "지원하지 않는 STOMP 버전입니다."),
    WEBSOCKET_CONNECTION_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "WebSocket 연결 처리 중 오류가 발생했습니다."),
    INVALID_ROOM_ID(HttpStatus.BAD_REQUEST, "채팅방 ID 형식이 올바르지 않습니다."),
    CHAT_ROOM_NOT_FOUND(HttpStatus.NOT_FOUND, "채팅방을 찾을 수 없습니다."),
    CHAT_ROOM_SUBSCRIPTION_DENIED(HttpStatus.FORBIDDEN, "채팅방 실시간 이벤트를 구독할 권한이 없습니다."),
    USER_CHANNEL_SUBSCRIPTION_DENIED(HttpStatus.FORBIDDEN, "사용자 전용 채널을 구독할 수 없습니다."),
    CHAT_ROOM_NOT_ACTIVE(HttpStatus.CONFLICT, "활성 상태가 아닌 채팅방에는 메시지를 보낼 수 없습니다."),
    CHAT_MESSAGE_SEND_FORBIDDEN(HttpStatus.FORBIDDEN, "채팅방에 메시지를 보낼 권한이 없습니다."),
    CHAT_MESSAGE_BLANK(HttpStatus.BAD_REQUEST, "메시지 내용이 비어 있습니다."),
    CHAT_MESSAGE_TOO_LONG(HttpStatus.BAD_REQUEST, "메시지 내용이 너무 깁니다."),

    // AI Chat Pattern Result (AI Worker 콜백)
    AI_CHAT_JOB_NOT_FOUND(HttpStatus.NOT_FOUND, "AI 채팅 분석 작업을 찾을 수 없습니다."),
    INVALID_CHAT_PATTERN_RESULT(HttpStatus.BAD_REQUEST, "패턴 분석 결과 형식이 올바르지 않습니다."),

    // Pin Evaluation
    INVALID_RATING(HttpStatus.BAD_REQUEST, "평가 값이 올바르지 않습니다."),
    PIN_EVALUATION_FORBIDDEN(HttpStatus.FORBIDDEN, "이 핀을 평가할 수 없습니다."),
    PIN_ALREADY_EVALUATED(HttpStatus.CONFLICT, "이미 평가한 핀입니다."),
    PIN_EVALUATION_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "핀 평가 등록 중 오류가 발생했습니다."),

    // Pin Unlock
    // INSUFFICIENT_CREDIT(409)·PIN_NOT_FOUND(404)·INVALID_PIN_ID(400)·UNAUTHORIZED(401)는 위에서 재사용한다.
    IDEMPOTENCY_KEY_REQUIRED(HttpStatus.BAD_REQUEST, "멱등성 키가 필요합니다."),
    INVALID_IDEMPOTENCY_KEY(HttpStatus.BAD_REQUEST, "멱등성 키 형식이 올바르지 않습니다."),
    IDEMPOTENCY_KEY_CONFLICT(HttpStatus.CONFLICT, "동일한 멱등성 키가 다른 요청에 사용되었습니다."),
    PIN_UNLOCK_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "영상 핀 잠금 해제 중 오류가 발생했습니다."),
    VIDEO_URL_ISSUE_FAILED(HttpStatus.SERVICE_UNAVAILABLE, "영상 URL 발급에 실패했습니다.");

    private final HttpStatus status;
    private final String message;
}

