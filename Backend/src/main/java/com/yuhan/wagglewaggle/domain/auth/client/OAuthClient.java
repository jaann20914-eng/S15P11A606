package com.yuhan.wagglewaggle.domain.auth.client;

import com.yuhan.wagglewaggle.domain.auth.entity.OAuthProvider;

/**
 * Provider별 OAuth 통신 추상화.
 * 인가 코드를 Provider Access Token으로 교환하고, 그 토큰으로 사용자 정보를 조회한다.
 */
public interface OAuthClient {

    OAuthProvider provider();

    /**
     * 인가 코드를 Provider Access Token으로 교환한다.
     * Redirect URI는 서버 설정값을 사용하며, 네이버는 state를 함께 사용한다.
     */
    String exchangeToken(String authorizationCode, String state);

    /**
     * Provider Access Token으로 사용자 정보를 조회한다.
     */
    OAuthUserInfo getUserInfo(String providerAccessToken);
}
