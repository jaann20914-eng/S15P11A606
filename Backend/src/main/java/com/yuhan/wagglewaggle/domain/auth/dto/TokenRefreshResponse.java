package com.yuhan.wagglewaggle.domain.auth.dto;

/**
 * 토큰 재발급 응답. RTR로 Access/Refresh 토큰을 모두 새로 발급한다.
 * expiresIn 값은 새 토큰의 남은 만료 시간(초)이다.
 */
public record TokenRefreshResponse(
        String accessToken,
        long accessTokenExpiresIn,
        String refreshToken,
        long refreshTokenExpiresIn
) {
}
