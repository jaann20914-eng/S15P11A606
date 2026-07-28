package com.yuhan.wagglewaggle.global.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "kakao.local")
public record KakaoProperties(
        String baseUrl,
        String restApiKey,
        int connectTimeoutMs,
        int readTimeoutMs
) {
}
