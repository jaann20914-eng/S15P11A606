package com.yuhan.wagglewaggle.global.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;

/**
 * AI 채팅 작업 재발행 정책 설정.
 * enabled: 재발행 스케줄러 사용 여부.
 * staleThreshold: 생성된 지 이 시간 이상 지났고 아직 미완료(PENDING/PROCESSING/FAILED)면 재발행 대상으로 본다.
 * maxRetryAge: 생성된 지 이 시간을 넘긴 미완료 작업은 재발행을 포기하고 FAILED로 마감한다.
 * 재발행 주기는 @Scheduled fixedDelayString(ai.chat.republish.interval-ms)으로 관리한다.
 */
@ConfigurationProperties(prefix = "ai.chat.republish")
public record AiChatRepublishProperties(
        boolean enabled,
        Duration staleThreshold,
        Duration maxRetryAge
) {
}
