package com.yuhan.wagglewaggle.domain.blur.publisher;

import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJob;
import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJobStatus;
import com.yuhan.wagglewaggle.domain.blur.repository.AiBlurJobRepository;
import com.yuhan.wagglewaggle.global.properties.AiBlurRepublishProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Instant;
import java.util.List;

/**
 * 재발행 스케줄러. 일정 시간 이상 PENDING인 AI 블러 작업을 주기적으로 다시 발행한다.
 * 기존 requestId·pinId·originalVideoKey를 그대로 재사용하며(동일 requestId 재발행),
 * 상태나 jobType을 변경하지 않는다. 재발행 대상은 jobType으로 제한하지 않는다.
 * 발행 성공 여부를 스키마에 저장하지 않으므로 AI 처리 중인 작업이 중복 발행될 수 있고, 이는 Worker 멱등 처리를 전제로 한다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AiBlurJobRepublishScheduler {

    private final AiBlurJobRepository aiBlurJobRepository;
    private final AiBlurJobPublisher aiBlurJobPublisher;
    private final AiBlurRepublishProperties properties;
    private final Clock clock;

    @Scheduled(fixedDelayString = "${ai.blur.republish.interval-ms:60000}")
    public void republishPendingJobs() {
        if (!properties.enabled()) {
            return;
        }

        Instant threshold = clock.instant().minus(properties.pendingThreshold());
        List<AiBlurJob> targets = aiBlurJobRepository
                .findByStatusAndCreatedAtLessThanOrderByCreatedAtAsc(AiBlurJobStatus.PENDING, threshold);
        if (targets.isEmpty()) {
            return;
        }

        log.info("AI 블러 작업 재발행 대상 {}건", targets.size());
        for (AiBlurJob job : targets) {
            try {
                // 상태 변경·저장 없이 동일 requestId로 재발행한다.
                aiBlurJobPublisher.publish(job);
            } catch (Exception e) {
                log.error("AI 블러 작업 재발행 실패 (requestId={})", job.getRequestId(), e);
            }
        }
    }
}
