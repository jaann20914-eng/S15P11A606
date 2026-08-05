package com.yuhan.wagglewaggle.domain.chat.scheduler;

import com.yuhan.wagglewaggle.domain.chat.message.AiChatAnalysisMessage;
import com.yuhan.wagglewaggle.domain.chat.publisher.AiChatJobPublisher;
import com.yuhan.wagglewaggle.domain.chat.service.AiChatJobService;
import com.yuhan.wagglewaggle.global.properties.AiChatRepublishProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * AI 채팅 작업 재발행 스케줄러. 주기적으로 오래 미완료(PENDING/PROCESSING/FAILED)로 남은 작업을 골라 다시 발행한다.
 * 대상 선별·상태 변경(포기 FAILED 마감, FAILED→PENDING 리셋)은 {@link AiChatJobService#prepareRepublishBatch()}가
 * 트랜잭션에서 커밋한 뒤 발행할 배치 목록을 반환하고, 실제 발행은 커밋 이후 이 스케줄러가 수행한다
 * (비동기 Publisher Confirm이 커밋 전 도착해 상태 전환을 놓치는 레이스를 피하기 위함. 기존 분석 스케줄러와 동일한 분리).
 * (단일 스케줄러 인스턴스 전제. 다중 인스턴스 중복 발행 방지는 별도 티켓.)
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AiChatJobRepublishScheduler {

    private final AiChatRepublishProperties properties;
    private final AiChatJobService aiChatJobService;
    private final AiChatJobPublisher aiChatJobPublisher;

    @Scheduled(fixedDelayString = "${ai.chat.republish.interval-ms:20000}")
    public void republishStuckJobs() {
        if (!properties.enabled()) {
            return;
        }

        // 대상 선별·상태 변경 트랜잭션이 커밋된 뒤 반환되므로, 이어지는 발행 시점엔 리셋/포기 상태가 이미 커밋되어 있다.
        List<AiChatAnalysisMessage> batches = aiChatJobService.prepareRepublishBatch();
        if (batches.isEmpty()) {
            return;
        }

        log.info("AI 채팅 작업 재발행 대상 {}건", batches.size());
        for (AiChatAnalysisMessage batch : batches) {
            try {
                aiChatJobPublisher.publish(batch);
            } catch (Exception e) {
                log.error("AI 채팅 작업 재발행 실패 (requestId={}, roomId={})",
                        batch.requestId(), batch.roomId(), e);
            }
        }
    }
}
