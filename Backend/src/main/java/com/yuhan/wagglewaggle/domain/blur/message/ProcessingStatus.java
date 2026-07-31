package com.yuhan.wagglewaggle.domain.blur.message;

/**
 * ai.blur.result 메시지의 처리 상태.
 * COMPLETED(처리 완료: PASS/FAIL 판정까지 도달) | FAILED(처리 자체 실패).
 */
public enum ProcessingStatus {
    COMPLETED,
    FAILED
}
