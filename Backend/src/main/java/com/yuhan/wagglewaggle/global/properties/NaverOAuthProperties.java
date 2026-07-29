package com.yuhan.wagglewaggle.global.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "oauth.naver")
public record NaverOAuthProperties(
        String clientId,
        String clientSecret,
        String redirectUri,
        String tokenUri,
        String apiUri
) {
}
