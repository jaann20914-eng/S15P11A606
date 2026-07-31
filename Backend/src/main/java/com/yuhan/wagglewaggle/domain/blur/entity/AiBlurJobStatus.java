package com.yuhan.wagglewaggle.domain.blur.entity;

/**
 * AI 블러 작업 상태. DB의 ai_blur_job_status_type 정의를 따른다.
 * PENDING(대기) → COMPLETED(완료) | FAILED(실패).
 */
public enum AiBlurJobStatus {
    PENDING,
    COMPLETED,
    FAILED
}
