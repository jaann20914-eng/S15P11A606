package com.yuhan.wagglewaggle.domain.auth.jwt;

/**
 * JWT의 purpose 클레임 값. 서버는 토큰 용도를 반드시 검증한다.
 * - ACCESS: 일반 서비스 API
 * - REFRESH: 액세스 토큰 재발급
 * - ONBOARDING: 온보딩 완료 요청 전용
 */
public enum TokenPurpose {
    ACCESS,
    REFRESH,
    ONBOARDING
}
