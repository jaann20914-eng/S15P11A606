package com.yuhan.wagglewaggle.domain.place.service;

/**
 * 장소 점수 재계산 경계(Port).
 *
 * <p>핀 수정으로 혼잡 단계나 장소가 실제로 바뀌면 관련 Place 점수를 재계산해야 한다.
 * 아직 장소 점수 계산 기능이 구현되지 않아, 이 인터페이스는 호출 지점(트랜잭션 커밋 이후)만
 * 고정하는 경계 역할을 한다. 실제 계산 로직은 후속 단계에서 구현 클래스로 채운다.</p>
 */
public interface PlaceScoreRecalculationPort {

    /**
     * 지정한 장소의 점수를 재계산한다. DB 트랜잭션 커밋 이후 호출된다.
     */
    void recalculate(Long placeId);
}
