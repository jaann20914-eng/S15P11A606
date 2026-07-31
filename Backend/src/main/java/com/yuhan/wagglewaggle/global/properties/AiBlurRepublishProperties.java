package com.yuhan.wagglewaggle.global.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/**
 * AI 블러 작업 재발행 정책 설정.
 * enabled: 재발행 스케줄러 사용 여부.
 * pendingThreshold: 이 시간 이상 PENDING인 작업을 재발행 대상으로 본다.
 * 재발행 주기는 @Scheduled fixedDelayString(ai.blur.republish.interval-ms)으로 관리한다.
 */
@ConfigurationProperties(prefix = "ai.blur.republish")
public record AiBlurRepublishProperties(
        boolean enabled,
        Duration pendingThreshold
) {
}
