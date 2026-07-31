package com.yuhan.wagglewaggle.domain.blur.publisher;

import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJob;

/**
 * AI 블러 작업 메시지 발행 경계.
 * 핀 등록 트랜잭션 커밋 이후 호출되며, 실제 RabbitMQ 발행은 다음 단계에서 구현체를 교체해 담당한다.
 */
public interface AiBlurJobPublisher {

    void publishInitialUpload(AiBlurJob aiBlurJob);
}
