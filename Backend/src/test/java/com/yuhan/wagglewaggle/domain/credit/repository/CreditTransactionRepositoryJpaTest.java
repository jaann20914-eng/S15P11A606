package com.yuhan.wagglewaggle.domain.credit.repository;

import com.yuhan.wagglewaggle.domain.credit.entity.CreditTransaction;
import com.yuhan.wagglewaggle.domain.credit.entity.CreditTransactionType;
import com.yuhan.wagglewaggle.domain.user.entity.AgeGroup;
import com.yuhan.wagglewaggle.domain.user.entity.Gender;
import com.yuhan.wagglewaggle.domain.user.entity.Member;
import com.yuhan.wagglewaggle.support.AbstractPostgresContainerTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 크레딧 내역 커서 조회 쿼리를 실제 PostgreSQL 위에서 검증한다.
 * null 파라미터 가드(유형·기간·커서), change_amount 부호 필터, created_at 윈도우 [start, end),
 * (created_at DESC, id DESC) 정렬과 커서 튜플 비교가 SQL에서 정확히 동작하는지 확인한다.
 */
class CreditTransactionRepositoryJpaTest extends AbstractPostgresContainerTest {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final PageRequest UNBOUNDED = PageRequest.of(0, 100);

    @Autowired private TestEntityManager em;
    @Autowired private CreditTransactionRepository repository;

    @Test
    @DisplayName("모든 파라미터가 null이면(ALL/ALL, 커서 없음) 본인 거래 전체를 created_at·id 내림차순으로 반환한다")
    void allNull_returnsAllOrderedDesc() {
        Long member = persistMember("owner");
        Long other = persistMember("other");

        Long t1 = persistTx(member, CreditTransactionType.WELCOME_BONUS, 10, 10, kst(2026, 7, 20, 12, 0));
        Long t2 = persistTx(member, CreditTransactionType.VIDEO_VIEWED, -3, 7, kst(2026, 7, 22, 12, 0));
        Long t3 = persistTx(member, CreditTransactionType.VIDEO_VIEWED, -3, 4, kst(2026, 7, 23, 12, 0));
        persistTx(other, CreditTransactionType.WELCOME_BONUS, 10, 10, kst(2026, 7, 23, 13, 0)); // 타인 거래

        // 모든 조건 off(ALL/ALL, 커서 없음)
        List<CreditTransaction> result = repository.findHistory(
                member, false, null, false, null, false, null, null, false, null, null, UNBOUNDED);

        assertThat(result).extracting(CreditTransaction::getId).containsExactly(t3, t2, t1);
    }

    @Test
    @DisplayName("EARNED(하한 1)는 적립(양수)만, SPENT(상한 -1)는 사용(음수)만 반환한다")
    void amountBounds_filterBySign() {
        Long member = persistMember("owner");
        Long earned = persistTx(member, CreditTransactionType.WELCOME_BONUS, 10, 10, kst(2026, 7, 20, 12, 0));
        Long spent = persistTx(member, CreditTransactionType.VIDEO_VIEWED, -3, 7, kst(2026, 7, 21, 12, 0));

        // EARNED: 하한 1 on
        assertThat(repository.findHistory(member, true, 1, false, null, false, null, null, false, null, null, UNBOUNDED))
                .extracting(CreditTransaction::getId).containsExactly(earned);
        // SPENT: 상한 -1 on
        assertThat(repository.findHistory(member, false, null, true, -1, false, null, null, false, null, null, UNBOUNDED))
                .extracting(CreditTransaction::getId).containsExactly(spent);
    }

    @Test
    @DisplayName("기간 윈도우 [start, end)는 start 포함·end 미포함으로 created_at을 필터한다")
    void periodWindow_startInclusiveEndExclusive() {
        Long member = persistMember("owner");
        Instant start = kst(2026, 7, 22, 4, 0);
        Instant end = kst(2026, 7, 23, 4, 0);

        Long atStart = persistTx(member, CreditTransactionType.VIDEO_VIEWED, -3, 7, start);            // 포함
        Long inside = persistTx(member, CreditTransactionType.VIDEO_VIEWED, -3, 4, kst(2026, 7, 22, 20, 0));
        persistTx(member, CreditTransactionType.VIDEO_VIEWED, -3, 1, kst(2026, 7, 22, 3, 59));         // start 이전
        persistTx(member, CreditTransactionType.VIDEO_VIEWED, -3, 1, end);                             // end == 미포함

        // 기간 윈도우 on
        List<CreditTransaction> result = repository.findHistory(
                member, false, null, false, null, true, start, end, false, null, null, UNBOUNDED);

        assertThat(result).extracting(CreditTransaction::getId).containsExactly(inside, atStart);
    }

    @Test
    @DisplayName("커서 이후 페이지는 created_at이 커서보다 이르거나, 같으면 id가 더 작은 거래만 반환한다(튜플 비교)")
    void afterCursor_tupleComparison() {
        Long member = persistMember("owner");
        Instant sameTime = kst(2026, 7, 22, 12, 0);
        Long high = persistTx(member, CreditTransactionType.WELCOME_BONUS, 10, 10, sameTime);
        Long low = persistTx(member, CreditTransactionType.VIDEO_VIEWED, -3, 7, sameTime); // 같은 시각, id 더 큼
        Long earlier = persistTx(member, CreditTransactionType.VIDEO_VIEWED, -3, 4, kst(2026, 7, 21, 12, 0));

        // 정렬 순서(created_at DESC, id DESC): low(같은시각·큰id), high(같은시각·작은id), earlier
        List<CreditTransaction> ordered = repository.findHistory(
                member, false, null, false, null, false, null, null, false, null, null, UNBOUNDED);
        assertThat(ordered).extracting(CreditTransaction::getId).containsExactly(low, high, earlier);

        // 커서 = low → 같은 시각이지만 id가 더 작은 high, 그리고 더 이른 earlier만 남는다
        List<CreditTransaction> afterLow = repository.findHistory(
                member, false, null, false, null, false, null, null, true, sameTime, low, UNBOUNDED);
        assertThat(afterLow).extracting(CreditTransaction::getId).containsExactly(high, earlier);
    }

    @Test
    @DisplayName("유형·기간·커서 필터를 동시에 적용한다")
    void combinedFilters() {
        Long member = persistMember("owner");
        Instant start = kst(2026, 7, 22, 4, 0);
        Instant end = kst(2026, 7, 25, 4, 0);

        Long spentInside = persistTx(member, CreditTransactionType.VIDEO_VIEWED, -3, 7, kst(2026, 7, 23, 12, 0));
        persistTx(member, CreditTransactionType.WELCOME_BONUS, 10, 10, kst(2026, 7, 23, 13, 0)); // 적립 → SPENT 제외
        persistTx(member, CreditTransactionType.VIDEO_VIEWED, -3, 4, kst(2026, 7, 21, 12, 0));   // 기간 밖

        // SPENT(상한 -1) + 기간 윈도우 동시 적용
        List<CreditTransaction> result = repository.findHistory(
                member, false, null, true, -1, true, start, end, false, null, null, UNBOUNDED);

        assertThat(result).extracting(CreditTransaction::getId).containsExactly(spentInside);
    }

    // ===== helpers =====

    private static Instant kst(int year, int month, int day, int hour, int minute) {
        return LocalDateTime.of(year, month, day, hour, minute, 0).atZone(KST).toInstant();
    }

    private Long persistMember(String nickname) {
        return em.persist(Member.create(nickname, AgeGroup.TWENTIES, Gender.FEMALE)).getId();
    }

    /** created_at(거래 시각)을 지정해 크레딧 거래를 저장한다. pin_id는 null(핀 무관 거래)로 둔다. */
    private Long persistTx(Long memberId, CreditTransactionType type, int changeAmount, int balanceAfter, Instant createdAt) {
        CreditTransaction tx = CreditTransaction.create(memberId, type, null, changeAmount, balanceAfter);
        em.persist(tx);
        // JPA Auditing이 persist 시점에 created_at을 현재 시각으로 채우므로, 원하는 거래 시각으로 덮어쓴다.
        ReflectionTestUtils.setField(tx, "createdAt", createdAt);
        em.flush();
        return tx.getId();
    }
}
