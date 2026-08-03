package com.yuhan.wagglewaggle.global.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 내부 시스템(AI Worker 등)이 호출하는 API의 공유 시크릿 설정.
 * secret: /api/v1/internal/** 요청의 X-Internal-Secret 헤더와 대조할 값.
 * 운영/CI/로컬 각 환경에서 INTERNAL_API_SECRET 환경변수로 주입한다.
 */
@ConfigurationProperties(prefix = "internal.api")
public record InternalApiProperties(
        String secret
) {
}
