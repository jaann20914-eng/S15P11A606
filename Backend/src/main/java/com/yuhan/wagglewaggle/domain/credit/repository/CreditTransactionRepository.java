package com.yuhan.wagglewaggle.domain.credit.repository;

import com.yuhan.wagglewaggle.domain.credit.entity.CreditTransaction;
import com.yuhan.wagglewaggle.domain.credit.entity.CreditTransactionType;
import org.springframework.data.jpa.repository.JpaRepository;

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
}
