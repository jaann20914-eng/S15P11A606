package com.yuhan.wagglewaggle.domain.blur.entity;

/**
 * AI 블러 작업 유형. DB의 ai_blur_job_type 정의를 따른다.
 * - INITIAL_UPLOAD: 최초 핀 등록 시 생성되는 최초 블러 작업.
 * - VIDEO_REPLACEMENT: 후속 영상 교체 API에서 사용하는 값(이번 단계는 구조만 준비).
 */
public enum AiBlurJobType {
    INITIAL_UPLOAD,
    VIDEO_REPLACEMENT
}
