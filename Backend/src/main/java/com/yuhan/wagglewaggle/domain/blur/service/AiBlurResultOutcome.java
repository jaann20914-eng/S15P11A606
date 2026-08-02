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
    /** 정의되지 않은 작업 유형(방어적 기본값). Pin을 변경하지 않는다. */
    UNSUPPORTED_JOB_TYPE,
    /** PASS이지만 블러 영상·썸네일 객체를 확인할 수 없어 DB를 변경하지 않았다. */
    OBJECT_NOT_FOUND,
    /**
     * 영상 교체 PASS 결과이지만 Pin에 반영할 수 없어(삭제·비ACTIVE·최신 교체 작업 아님)
     * 새 영상을 적용하지 않고 작업만 최종 상태로 종료했다. 재처리하지 않도록 ACK 대상이다.
     */
    REPLACEMENT_SKIPPED,
    /**
     * 대상 핀이 이미 소프트 삭제되어(deleted_at 기록) 결과를 핀에 반영하지 않고
     * 작업만 최종 상태로 종료했다(영상 키·video_status 미변경). 재처리하지 않도록 ACK 대상이다.
     */
    PIN_DELETED_SKIPPED,
    /** requestId로 AI 블러 작업을 찾을 수 없다. */
    JOB_NOT_FOUND
}
