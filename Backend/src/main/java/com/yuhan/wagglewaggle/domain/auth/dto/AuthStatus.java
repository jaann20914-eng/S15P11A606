package com.yuhan.wagglewaggle.domain.auth.dto;

/**
 * 서비스 인증 처리 상태. Front는 이 값으로 다음 화면을 결정한다.
 */
public enum AuthStatus {
    AUTHENTICATED,
    ONBOARDING_REQUIRED
}
