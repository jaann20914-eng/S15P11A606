package com.yuhan.wagglewaggle.domain.auth.dto;

/**
 * OAuth 로그인 요청 바디.
 * authorizationCode: Provider 인가 코드(일회성), state: 위·변조 방지 값.
 * redirectUri는 클라이언트로부터 받지 않는다(서버 설정값 사용).
 */
public record OAuthLoginRequest(
        String authorizationCode,
        String state
) {
}
