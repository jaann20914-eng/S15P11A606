package com.yuhan.wagglewaggle.domain.credit.repository;

import com.yuhan.wagglewaggle.domain.credit.entity.CreditTransaction;
import com.yuhan.wagglewaggle.domain.credit.entity.CreditTransactionType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
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

    // ===== 크레딧 내역 목록(커서 페이지네이션) =====
    // 대상 = 현재 사용자의 거래 전체. 유형 필터는 change_amount 부호(min/max 경계)로, 기간 필터는
    //        created_at 범위 [start, end)로 적용한다. 적용 여부는 apply* 플래그로 켜고 끈다.
    // 정렬 = created_at DESC, id DESC. limit+1건을 조회해 다음 페이지 존재 여부를 판단한다(nextCursor 발급용).
    // 커서 = 마지막 노출 항목의 (created_at, id). applyCursor=false 면 첫 페이지다.
    //
    // apply* 플래그로 조건을 끄는 이유: 값 파라미터를 ':param IS NULL'로 검사하면 PostgreSQL이
    // 해당 바인딩의 타입을 추론하지 못해("could not determine data type of parameter") 실패한다.
    // 값 파라미터는 항상 컬럼과의 타입 있는 비교에만 두고, 조건 on/off는 boolean 플래그로 분리한다.

    /**
     * 크레딧 거래 내역을 유형·기간·커서 조건으로 조회한다.
     *
     * <p>applyMinAmount·applyMaxAmount는 유형 필터(EARNED=하한 1, SPENT=상한 -1, ALL=둘 다 off),
     * applyPeriod는 서비스 날짜 윈도우 [start, endExclusive), applyCursor는 커서 적용 여부다.
     * 정렬(created_at DESC, id DESC)과 동일한 타이브레이커로 커서보다 "뒤"에 오는 거래
     * (created_at이 더 이르거나, 같으면 id가 더 작은 거래)만 조회한다.</p>
     */
    @Query("""
            SELECT c FROM CreditTransaction c
            WHERE c.memberId = :memberId
              AND (:applyMinAmount = FALSE OR c.changeAmount >= :minChangeAmount)
              AND (:applyMaxAmount = FALSE OR c.changeAmount <= :maxChangeAmount)
              AND (:applyPeriod = FALSE OR (c.createdAt >= :start AND c.createdAt < :endExclusive))
              AND (:applyCursor = FALSE
                   OR c.createdAt < :cursorCreatedAt
                   OR (c.createdAt = :cursorCreatedAt AND c.id < :cursorId))
            ORDER BY c.createdAt DESC, c.id DESC
            """)
    List<CreditTransaction> findHistory(
            @Param("memberId") Long memberId,
            @Param("applyMinAmount") boolean applyMinAmount,
            @Param("minChangeAmount") Integer minChangeAmount,
            @Param("applyMaxAmount") boolean applyMaxAmount,
            @Param("maxChangeAmount") Integer maxChangeAmount,
            @Param("applyPeriod") boolean applyPeriod,
            @Param("start") Instant start,
            @Param("endExclusive") Instant endExclusive,
            @Param("applyCursor") boolean applyCursor,
            @Param("cursorCreatedAt") Instant cursorCreatedAt,
            @Param("cursorId") Long cursorId,
            Pageable pageable
    );
}
