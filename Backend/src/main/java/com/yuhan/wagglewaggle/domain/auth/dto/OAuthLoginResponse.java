package com.yuhan.wagglewaggle.domain.auth.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * OAuth 로그인 응답. 상태에 따라 일부 필드만 포함된다(@JsonInclude(NON_NULL)).
 * - AUTHENTICATED: accessToken, refreshToken
 * - ONBOARDING_REQUIRED: onboardingToken
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record OAuthLoginResponse(
        AuthStatus authStatus,
        String accessToken,
        String refreshToken,
        String onboardingToken
) {
    public static OAuthLoginResponse authenticated(String accessToken, String refreshToken) {
        return new OAuthLoginResponse(AuthStatus.AUTHENTICATED, accessToken, refreshToken, null);
    }

    public static OAuthLoginResponse onboardingRequired(String onboardingToken) {
        return new OAuthLoginResponse(AuthStatus.ONBOARDING_REQUIRED, null, null, onboardingToken);
    }
}
