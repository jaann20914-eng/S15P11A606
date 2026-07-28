package com.yuhan.wagglewaggle.domain.auth.client;

/**
 * Provider 사용자 정보에서 서비스가 사용하는 최소 정보.
 * providerUserId는 Provider 고유 사용자 식별자, email은 있을 수도 없을 수도 있다.
 */
public record OAuthUserInfo(
        String providerUserId,
        String email
) {
}
