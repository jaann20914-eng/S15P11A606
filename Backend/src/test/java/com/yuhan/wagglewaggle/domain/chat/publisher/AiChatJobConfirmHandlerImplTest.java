package com.yuhan.wagglewaggle.domain.chat.publisher;

import com.yuhan.wagglewaggle.domain.chat.entity.AiChatJob;
import com.yuhan.wagglewaggle.domain.chat.entity.AiChatJobStatus;
import com.yuhan.wagglewaggle.domain.chat.repository.AiChatJobRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.amqp.rabbit.connection.CorrelationData;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AiChatJobConfirmHandlerImplTest {

    @Mock private AiChatJobRepository aiChatJobRepository;

    private AiChatJobConfirmHandlerImpl handler;

    private static final UUID REQUEST_ID = UUID.fromString("4f7c19da-b64d-4bf5-8a9c-7689e59566ac");

    @BeforeEach
    void setUp() {
        handler = new AiChatJobConfirmHandlerImpl(aiChatJobRepository);
    }

    private AiChatJob pendingJob() {
        AiChatJob job = AiChatJob.create(1L, 5L, 7L);
        ReflectionTestUtils.setField(job, "requestId", REQUEST_ID);
        return job;
    }

    @Test
    void ack이고_PENDING이면_PROCESSING으로_전환한다() {
        AiChatJob job = pendingJob();
        when(aiChatJobRepository.findById(REQUEST_ID)).thenReturn(Optional.of(job));

        handler.onConfirm(new CorrelationData(REQUEST_ID.toString()), true);

        assertThat(job.getStatus()).isEqualTo(AiChatJobStatus.PROCESSING);
    }

    @Test
    void ack이지만_이미_처리된_작업이면_상태를_바꾸지_않는다() {
        AiChatJob job = pendingJob();
        job.markCompleted(Instant.parse("2026-08-03T09:00:00Z"));
        when(aiChatJobRepository.findById(REQUEST_ID)).thenReturn(Optional.of(job));

        handler.onConfirm(new CorrelationData(REQUEST_ID.toString()), true);

        assertThat(job.getStatus()).isEqualTo(AiChatJobStatus.COMPLETED);
    }

    @Test
    void NACK이면_작업을_조회하지_않고_상태를_바꾸지_않는다() {
        handler.onConfirm(new CorrelationData(REQUEST_ID.toString()), false);

        verify(aiChatJobRepository, never()).findById(any());
    }

    @Test
    void correlationData가_없으면_스킵한다() {
        handler.onConfirm(null, true);

        verify(aiChatJobRepository, never()).findById(any());
    }
}
