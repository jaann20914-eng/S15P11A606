package com.yuhan.wagglewaggle.domain.blur.service;

/**
 * 영상 객체 삭제 대상 등록 경계(Port).
 *
 * <p>영상 교체 결과 반영 시 더 이상 쓰지 않는 객체(기존 공개 영상 키, 반영되지 않은 후보 원본,
 * AI가 생성했지만 적용하지 않은 결과 객체)를 삭제 대상으로 등록한다. DB 트랜잭션 커밋 이후 호출된다.</p>
 *
 * <p>아직 삭제 대상 등록/삭제 기능(테이블·Scheduler 등)이 없어, 이 인터페이스는 호출 지점만 고정하는
 * 경계 역할을 한다. 실제 등록·삭제 로직은 후속 단계에서 구현 클래스로 채운다.</p>
 */
public interface VideoObjectCleanupPort {

    /**
     * 지정한 객체 키를 삭제 대상으로 등록한다. key가 null이거나 공백이면 무시한다.
     */
    void registerForDeletion(String objectKey);
}
