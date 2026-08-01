package com.yuhan.wagglewaggle.domain.blur.service;

/**
 * AI 블러 결과 반영 처리 결과.
 * 후속 단계(RabbitMQ Listener)에서 ACK/NACK 판단에 사용할 수 있도록 처리 유형을 구분한다.
 */
public enum AiBlurResultOutcome {
    /** 결과를 정상적으로 DB에 반영했다. */
    APPLIED,
    /** 이미 동일 최종 상태로 처리된 작업의 같은 결과(멱등, 추가 변경 없음). */
    DUPLICATE,
    /** 이미 최종 상태인 작업에 충돌하는 결과가 도착(기존 상태 유지). */
    CONFLICT,
    /** 이번 단계에서 처리하지 않는 작업 유형(예: VIDEO_REPLACEMENT). Pin을 변경하지 않는다. */
    UNSUPPORTED_JOB_TYPE,
    /** PASS이지만 블러 영상·썸네일 객체를 확인할 수 없어 DB를 변경하지 않았다. */
    OBJECT_NOT_FOUND,
    /** requestId로 AI 블러 작업을 찾을 수 없다. */
    JOB_NOT_FOUND
}
