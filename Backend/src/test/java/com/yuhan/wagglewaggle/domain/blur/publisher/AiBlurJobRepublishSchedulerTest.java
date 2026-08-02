package com.yuhan.wagglewaggle.domain.blur.publisher;

import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJob;
import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJobStatus;
import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJobType;
import com.yuhan.wagglewaggle.domain.blur.repository.AiBlurJobRepository;
import com.yuhan.wagglewaggle.global.properties.AiBlurRepublishProperties;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.BDDMockito.willThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class AiBlurJobRepublishSchedulerTest {

    @Mock private AiBlurJobRepository aiBlurJobRepository;
    @Mock private AiBlurJobPublisher aiBlurJobPublisher;

    private static final Instant NOW = Instant.parse("2026-07-31T12:00:00Z");
    private static final Duration THRESHOLD = Duration.ofMinutes(5);
    private final Clock fixedClock = Clock.fixed(NOW, ZoneOffset.UTC);

    private AiBlurJobRepublishScheduler scheduler(boolean enabled) {
        return new AiBlurJobRepublishScheduler(
                aiBlurJobRepository, aiBlurJobPublisher,
                new AiBlurRepublishProperties(enabled, THRESHOLD), fixedClock);
    }

    private AiBlurJob job(AiBlurJobType type) {
        AiBlurJob job = AiBlurJob.create(UUID.randomUUID(), "pins/original/1/key.mp4", type);
        ReflectionTestUtils.setField(job, "requestId", UUID.randomUUID());
        return job;
    }

    @Test
    void 비활성화면_조회도_발행도_하지_않는다() {
        scheduler(false).republishPendingJobs();

        verifyNoInteractions(aiBlurJobRepository, aiBlurJobPublisher);
    }

    @Test
    void PENDING_임계시각_기준으로_조회해_각_작업을_동일_requestId로_재발행한다() {
        AiBlurJob initial = job(AiBlurJobType.INITIAL_UPLOAD);
        AiBlurJob replacement = job(AiBlurJobType.VIDEO_REPLACEMENT); // jobType으로 제한하지 않음
        given(aiBlurJobRepository.findRepublishTargetsExcludingDeletedPins(any(), any()))
                .willReturn(List.of(initial, replacement));

        scheduler(true).republishPendingJobs();

        // 조회 조건: status=PENDING, threshold=now-5m
        ArgumentCaptor<Instant> thresholdCaptor = ArgumentCaptor.forClass(Instant.class);
        verify(aiBlurJobRepository).findRepublishTargetsExcludingDeletedPins(
                eq(AiBlurJobStatus.PENDING), thresholdCaptor.capture());
        assertThat(thresholdCaptor.getValue()).isEqualTo(NOW.minus(THRESHOLD));

        // 각 작업을 그대로(동일 requestId) 재발행하고, 상태나 jobType은 변경/저장하지 않는다.
        verify(aiBlurJobPublisher).publish(initial);
        verify(aiBlurJobPublisher).publish(replacement);
        verify(aiBlurJobRepository, never()).save(any());
        assertThat(initial.getStatus()).isEqualTo(AiBlurJobStatus.PENDING);
        assertThat(initial.getJobType()).isEqualTo(AiBlurJobType.INITIAL_UPLOAD);
        assertThat(replacement.getJobType()).isEqualTo(AiBlurJobType.VIDEO_REPLACEMENT);
    }

    @Test
    void 한_작업_발행이_실패해도_나머지_작업은_계속_재발행한다() {
        AiBlurJob first = job(AiBlurJobType.INITIAL_UPLOAD);
        AiBlurJob second = job(AiBlurJobType.INITIAL_UPLOAD);
        given(aiBlurJobRepository.findRepublishTargetsExcludingDeletedPins(any(), any()))
                .willReturn(List.of(first, second));
        willThrow(new RuntimeException("발행 실패")).given(aiBlurJobPublisher).publish(first);

        scheduler(true).republishPendingJobs();

        verify(aiBlurJobPublisher).publish(first);
        verify(aiBlurJobPublisher).publish(second);
    }
}
