package com.yuhan.wagglewaggle.domain.credit.repository;

import com.yuhan.wagglewaggle.domain.credit.entity.CreditTransaction;
import com.yuhan.wagglewaggle.domain.credit.entity.CreditTransactionType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

public interface CreditTransactionRepository extends JpaRepository<CreditTransaction, Long> {

    /**
     * 특정 회원의 특정 핀·유형 크레딧 거래 중 가장 최근 1건을 조회한다.
     * 동일 멱등 요청 재시도 응답의 creditBalance를 "최초 잠금 해제로 생성된 구매자 차감 거래"의
     * balance_after로 반환하기 위해 사용한다. member_id 필터가 구매자(-3)와 작성자(+3) 행을 구분한다.
     */
    Optional<CreditTransaction> findTopByMemberIdAndPinIdAndTypeOrderByIdDesc(
            Long memberId, UUID pinId, CreditTransactionType type);

    /**
     * 선택 월(서비스 날짜 기준 [startDate, endDateExclusive))에 적립 완료된 유효 크레딧 합계(earnedCredit용).
     * 적립 완료 시점 = created_at. 서비스 날짜 경계 = Asia/Seoul 매일 04시.
     * change_amount > 0(적립)만 합산하므로 차감·회수(음수 거래)는 자연히 제외된다.
     * 결과가 없으면 COALESCE로 0을 반환한다.
     */
    @Query(value = """
            SELECT COALESCE(SUM(c.change_amount), 0)
            FROM credit_transactions c
            WHERE c.member_id = :memberId
              AND c.change_amount > 0
              AND ((c.created_at AT TIME ZONE 'Asia/Seoul') - INTERVAL '4 hour')::date >= :startDate
              AND ((c.created_at AT TIME ZONE 'Asia/Seoul') - INTERVAL '4 hour')::date <  :endDateExclusive
            """, nativeQuery = true)
    long sumEarnedCreditByServiceMonth(
            @Param("memberId") Long memberId,
            @Param("startDate") LocalDate startDate,
            @Param("endDateExclusive") LocalDate endDateExclusive
    );
}
