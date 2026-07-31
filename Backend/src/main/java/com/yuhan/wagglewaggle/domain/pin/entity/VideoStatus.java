package com.yuhan.wagglewaggle.domain.pin.entity;

/**
 * 핀 영상 상태. 비동기 핀 등록 흐름에 맞춘 값이며 pins.video_status에 저장된다.
 * PENDING(등록 후 AI 블러 대기) → ACTIVE(블러 완료·노출) | REJECTED(반려) | FAILED(처리 실패).
 * PUBLISHED 상태는 사용하지 않는다.
 */
public enum VideoStatus {
    PENDING,
    ACTIVE,
    REJECTED,
    FAILED
}
