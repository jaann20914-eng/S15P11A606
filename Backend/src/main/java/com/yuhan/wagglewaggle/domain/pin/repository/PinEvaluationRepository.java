package com.yuhan.wagglewaggle.domain.pin.repository;

import com.yuhan.wagglewaggle.domain.pin.entity.PinEvaluation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.UUID;

public interface PinEvaluationRepository extends JpaRepository<PinEvaluation, Long> {

    /**
     * 특정 회원이 해당 핀을 평가한 기록이 있는지 검사한다(핀 상세 isEvaluated 판정용).
     * (pin_id, member_id) 유니크 제약이 있어 회원당 핀 평가는 최대 1건이며,
     * 행의 존재 자체가 평가 완료를 의미한다. 조회만 하고 생성·수정하지 않는다.
     */
    boolean existsByPin_IdAndMember_Id(UUID pinId, Long memberId);

    /**
     * 선택 월(서비스 날짜 기준 [startDate, endDateExclusive))에 본인 영상핀이 받은 HELPFUL 평가 수(helpfulEvaluationCount용).
     * 평가 등록 완료 시점 = created_at. 서비스 날짜 경계 = Asia/Seoul 매일 04시.
     * 대상 핀의 작성자가 본인(p.member_id = :memberId)이고, 평가자는 본인이 아니며(e.member_id <> :memberId),
     * 평가값이 HELPFUL인 건만 센다. 작성자 본인 평가와 NOT_HELPFUL은 제외된다.
     */
    @Query(value = """
            SELECT COUNT(*)
            FROM pin_evaluations e
            JOIN pins p ON p.id = e.pin_id
            WHERE p.member_id = :memberId
              AND e.member_id <> :memberId
              AND e.evaluation = 'HELPFUL'
              AND ((e.created_at AT TIME ZONE 'Asia/Seoul') - INTERVAL '4 hour')::date >= :startDate
              AND ((e.created_at AT TIME ZONE 'Asia/Seoul') - INTERVAL '4 hour')::date <  :endDateExclusive
            """, nativeQuery = true)
    long countHelpfulEvaluationsByServiceMonth(
            @Param("memberId") Long memberId,
            @Param("startDate") LocalDate startDate,
            @Param("endDateExclusive") LocalDate endDateExclusive
    );
}
