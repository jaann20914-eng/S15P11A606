package com.yuhan.wagglewaggle.domain.auth.dto;

/**
 * 토큰 재발급 요청. refreshToken은 클라이언트 입장에서 opaque 문자열로 취급한다.
 */
public record TokenRefreshRequest(
        String refreshToken
) {
}
