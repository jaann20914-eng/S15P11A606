package com.yuhan.wagglewaggle.global.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * AI 추천점수 API(POST /api/v1/internal/recommendations/score) 호출 설정.
 * internalApiKey는 Back↔AI 내부 통신 공유 비밀키(x-internal-api-key 헤더)로, AI의 INTERNAL_API_KEY와 같아야 한다.
 * readTimeoutMs는 스펙상 2초(2000ms)이며 타임아웃 시 AI_RECOMMENDATION_FAILED로 매핑한다.
 */
@ConfigurationProperties(prefix = "ai.recommendation")
public record AiRecommendationProperties(
        String baseUrl,
        String internalApiKey,
        int connectTimeoutMs,
        int readTimeoutMs
) {
}
