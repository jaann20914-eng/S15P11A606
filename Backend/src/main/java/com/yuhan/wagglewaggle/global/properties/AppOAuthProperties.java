package com.yuhan.wagglewaggle.global.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 웹 OAuth 콜백을 앱으로 되돌려보낼 때 사용하는 커스텀 스킴 설정.
 * 프로바이더는 {@code https://.../oauth/callback/{provider}} 로 리다이렉트하고,
 * 이 콜백이 다시 {@code {scheme}://oauth/callback/{provider}} 로 302 리다이렉트한다.
 */
@ConfigurationProperties(prefix = "app.oauth")
public record AppOAuthProperties(
        String callbackScheme
) {
    public AppOAuthProperties {
        if (callbackScheme == null || callbackScheme.isBlank()) {
            callbackScheme = "waglewagle";
        }
    }
}
