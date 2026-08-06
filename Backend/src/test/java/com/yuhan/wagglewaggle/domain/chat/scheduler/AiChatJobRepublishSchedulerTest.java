package com.yuhan.wagglewaggle.domain.chat.scheduler;

import com.yuhan.wagglewaggle.domain.chat.message.AiChatAnalysisMessage;
import com.yuhan.wagglewaggle.domain.chat.publisher.AiChatJobPublisher;
import com.yuhan.wagglewaggle.domain.chat.service.AiChatJobService;
import com.yuhan.wagglewaggle.global.properties.AiChatRepublishProperties;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AiChatJobRepublishSchedulerTest {

    @Mock private AiChatJobService aiChatJobService;
    @Mock private AiChatJobPublisher aiChatJobPublisher;

    private static final Duration STALE_THRESHOLD = Duration.ofSeconds(10);
    private static final Duration MAX_RETRY_AGE = Duration.ofMinutes(3);

    private AiChatJobRepublishScheduler scheduler(boolean enabled) {
        return new AiChatJobRepublishScheduler(
                new AiChatRepublishProperties(enabled, STALE_THRESHOLD, MAX_RETRY_AGE),
                aiChatJobService, aiChatJobPublisher);
    }

    private AiChatAnalysisMessage batch(UUID requestId, long roomId) {
        return new AiChatAnalysisMessage(requestId, roomId, Instant.parse("2026-08-03T09:12:34Z"),
                List.of(new AiChatAnalysisMessage.ChatMessagePayload(2L, "메시지")));
    }

    @Test
    void 비활성화면_준비도_발행도_하지_않는다() {
        scheduler(false).republishStuckJobs();

        verifyNoInteractions(aiChatJobService, aiChatJobPublisher);
    }

    @Test
    void 준비된_배치가_없으면_발행하지_않는다() {
        when(aiChatJobService.prepareRepublishBatch()).thenReturn(List.of());

        scheduler(true).republishStuckJobs();

        verify(aiChatJobService).prepareRepublishBatch();
        verifyNoInteractions(aiChatJobPublisher);
    }

    @Test
    void 준비된_각_배치를_발행한다() {
        AiChatAnalysisMessage first = batch(UUID.randomUUID(), 1L);
        AiChatAnalysisMessage second = batch(UUID.randomUUID(), 2L);
        given(aiChatJobService.prepareRepublishBatch()).willReturn(List.of(first, second));

        scheduler(true).republishStuckJobs();

        verify(aiChatJobPublisher).publish(first);
        verify(aiChatJobPublisher).publish(second);
    }

    @Test
    void 한_배치_발행이_실패해도_나머지_배치는_계속_발행한다() {
        AiChatAnalysisMessage first = batch(UUID.randomUUID(), 1L);
        AiChatAnalysisMessage second = batch(UUID.randomUUID(), 2L);
        given(aiChatJobService.prepareRepublishBatch()).willReturn(List.of(first, second));
        willThrow(new RuntimeException("발행 실패")).given(aiChatJobPublisher).publish(first);

        scheduler(true).republishStuckJobs();

        verify(aiChatJobPublisher).publish(first);
        verify(aiChatJobPublisher).publish(second);
    }
}
