package com.yuhan.wagglewaggle.domain.blur.message;

/**
 * ai.blur.result 메시지의 최종 판정 결과.
 * PASS(블러 성공, 영상 사용 가능) | FAIL(블러 판정 실패).
 * processingStatus=FAILED인 경우 finalStatus는 null이다.
 */
public enum FinalStatus {
    PASS,
    FAIL
}
