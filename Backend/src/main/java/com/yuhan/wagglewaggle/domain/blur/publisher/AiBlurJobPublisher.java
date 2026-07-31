package com.yuhan.wagglewaggle.domain.blur.publisher;

import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJob;

/**
 * AI 블러 작업 메시지 발행 경계.
 * 핀 등록 트랜잭션 커밋 이후, 그리고 재발행 스케줄러에서 호출된다.
 * jobType과 무관하게 동일 Publisher로 발행하므로(INITIAL_UPLOAD·향후 VIDEO_REPLACEMENT 공용) 메서드는 job 하나만 받는다.
 */
public interface AiBlurJobPublisher {

    void publish(AiBlurJob aiBlurJob);
}
