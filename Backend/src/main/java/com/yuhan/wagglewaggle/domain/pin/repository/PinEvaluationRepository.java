package com.yuhan.wagglewaggle.domain.pin.repository;

import com.yuhan.wagglewaggle.domain.pin.entity.PinEvaluation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface PinEvaluationRepository extends JpaRepository<PinEvaluation, Long> {

    /**
     * 특정 회원이 해당 핀을 평가한 기록이 있는지 검사한다(핀 상세 isEvaluated 판정용).
     * (pin_id, member_id) 유니크 제약이 있어 회원당 핀 평가는 최대 1건이며,
     * 행의 존재 자체가 평가 완료를 의미한다. 조회만 하고 생성·수정하지 않는다.
     */
    boolean existsByPin_IdAndMember_Id(UUID pinId, Long memberId);
}
