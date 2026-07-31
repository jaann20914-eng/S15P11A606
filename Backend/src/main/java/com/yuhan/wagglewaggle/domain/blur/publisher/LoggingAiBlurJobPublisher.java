package com.yuhan.wagglewaggle.domain.blur.publisher;

import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJob;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * 임시 발행 구현. 이번 단계에서는 실제 발행 없이 발행 대상만 로깅한다.
 * 다음 단계에서 RabbitMQ 발행 구현체로 교체한다.
 */
@Slf4j
@Component
public class LoggingAiBlurJobPublisher implements AiBlurJobPublisher {

    @Override
    public void publishInitialUpload(AiBlurJob aiBlurJob) {
        log.info("AI 블러 작업 발행 예약 (requestId={}, pinId={}, jobType={}) — 실제 발행은 다음 단계",
                aiBlurJob.getRequestId(), aiBlurJob.getPinId(), aiBlurJob.getJobType());
    }
}
