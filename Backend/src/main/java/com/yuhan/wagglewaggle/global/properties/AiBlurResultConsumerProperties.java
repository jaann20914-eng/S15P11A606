package com.yuhan.wagglewaggle.global.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** AI 블러 결과 Queue를 병렬 처리하는 Consumer 수와 메시지 선점 개수 설정. */
@ConfigurationProperties(prefix = "ai.blur.result-consumer")
public record AiBlurResultConsumerProperties(
        int concurrency,
        int maxConcurrency,
        int prefetch
) {
    public AiBlurResultConsumerProperties {
        if (concurrency < 1) {
            throw new IllegalArgumentException("AI 블러 결과 Consumer concurrency는 1 이상이어야 합니다.");
        }
        if (maxConcurrency < concurrency) {
            throw new IllegalArgumentException("AI 블러 결과 maxConcurrency는 concurrency 이상이어야 합니다.");
        }
        if (prefetch < 1) {
            throw new IllegalArgumentException("AI 블러 결과 Consumer prefetch는 1 이상이어야 합니다.");
        }
    }
}
