package com.yuhan.wagglewaggle.global.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * AI 채팅 2차 분석 배치 설정.
 * enabled: 배치 스케줄러 사용 여부.
 * 조회 주기는 @Scheduled fixedDelayString(ai.chat.analysis.interval-ms)으로 관리한다.
 */
@ConfigurationProperties(prefix = "ai.chat.analysis")
public record AiChatAnalysisProperties(
        boolean enabled
) {
}
