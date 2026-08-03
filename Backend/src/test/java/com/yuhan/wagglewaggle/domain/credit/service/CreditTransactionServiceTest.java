package com.yuhan.wagglewaggle.domain.credit.service;

import com.yuhan.wagglewaggle.domain.credit.dto.CreditTransactionItem;
import com.yuhan.wagglewaggle.domain.credit.dto.CreditTransactionListResponse;
import com.yuhan.wagglewaggle.domain.credit.entity.CreditTransaction;
import com.yuhan.wagglewaggle.domain.credit.entity.CreditTransactionType;
import com.yuhan.wagglewaggle.domain.credit.repository.CreditTransactionRepository;
import com.yuhan.wagglewaggle.domain.user.entity.AgeGroup;
import com.yuhan.wagglewaggle.domain.user.entity.Gender;
import com.yuhan.wagglewaggle.domain.user.entity.Member;
import com.yuhan.wagglewaggle.domain.user.repository.MemberRepository;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

class CreditTransactionServiceTest {

    private static final Long MEMBER_ID = 42L;
    private static final int BALANCE = 12;
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    // 고정 현재 시각: KST 2026-08-03 10:00 → 서비스 날짜 2026-08-03
    private static final Instant NOW = LocalDateTime.of(2026, 8, 3, 10, 0).atZone(KST).toInstant();

    private MemberRepository memberRepository;
    private CreditTransactionRepository creditTransactionRepository;
    private CreditTransactionService service;

    @BeforeEach
    void setUp() {
        memberRepository = mock(MemberRepository.class);
        creditTransactionRepository = mock(CreditTransactionRepository.class);
        Clock clock = Clock.fixed(NOW, KST);
        service = new CreditTransactionService(memberRepository, creditTransactionRepository, clock);

        given(memberRepository.findById(MEMBER_ID)).willReturn(Optional.of(memberWithBalance(BALANCE)));
    }

    /**
     * findHistory(memberId, ...나머지 11개 인자)를 모두 매칭하는 기본 스터빙.
     * boolean 파라미터는 anyBoolean()으로, 나머지는 any()로 매칭한다(primitive에 any() 사용 시 NPE 방지).
     */
    private void stubHistory(List<CreditTransaction> result) {
        given(creditTransactionRepository.findHistory(
                eq(MEMBER_ID), anyBoolean(), any(), anyBoolean(), any(),
                anyBoolean(), any(), any(), anyBoolean(), any(), any(), any()))
                .willReturn(result);
    }

    @Test
    @DisplayName("기본값(ALL/ALL)으로 조회하면 유형·기간·커서 조건을 모두 끄고 기본 limit(20)으로 조회하며 잔액을 반환한다")
    void defaults_noFilters() {
        // 중첩 스터빙 방지를 위해 mock 거래 리스트를 먼저 구성한 뒤 스터빙한다.
        List<CreditTransaction> transactions = List.of(tx(1L, CreditTransactionType.VIDEO_VIEWED, -3, 12, NOW));
        stubHistory(transactions);

        CreditTransactionListResponse response =
                service.getMyCreditTransactions(MEMBER_ID, null, null, null, null);

        assertThat(response.balance()).isEqualTo(BALANCE);
        assertThat(response.items()).hasSize(1);
        assertThat(response.nextCursor()).isNull();

        verify(creditTransactionRepository).findHistory(
                eq(MEMBER_ID),
                eq(false), isNull(),          // 유형 하한 미적용
                eq(false), isNull(),          // 유형 상한 미적용
                eq(false), isNull(), isNull(), // 기간 미적용
                eq(false), isNull(), isNull(), // 커서 없음
                eq(PageRequest.of(0, 21)));    // limit + 1
    }

    @Test
    @DisplayName("type=EARNED는 change_amount 하한 1을 켜고, type=SPENT는 상한 -1을 켜서 전달한다")
    void typeFilter_translatesToAmountBounds() {
        stubHistory(List.of());

        service.getMyCreditTransactions(MEMBER_ID, "EARNED", null, null, null);
        verify(creditTransactionRepository).findHistory(
                eq(MEMBER_ID), eq(true), eq(1), eq(false), isNull(),
                anyBoolean(), any(), any(), anyBoolean(), any(), any(), any());

        service.getMyCreditTransactions(MEMBER_ID, "SPENT", null, null, null);
        verify(creditTransactionRepository).findHistory(
                eq(MEMBER_ID), eq(false), isNull(), eq(true), eq(-1),
                anyBoolean(), any(), any(), anyBoolean(), any(), any(), any());
    }

    @Test
    @DisplayName("period=TODAY는 서비스 날짜 1일 [04시, 다음날 04시) 윈도우를 켜서 전달한다")
    void periodFilter_today_window() {
        stubHistory(List.of());

        service.getMyCreditTransactions(MEMBER_ID, null, "TODAY", null, null);

        verify(creditTransactionRepository).findHistory(
                eq(MEMBER_ID), anyBoolean(), any(), anyBoolean(), any(),
                eq(true), eq(kst(2026, 8, 3, 4, 0)), eq(kst(2026, 8, 4, 4, 0)),
                anyBoolean(), any(), any(), any());
    }

    @Test
    @DisplayName("period=WEEK은 현재 포함 최근 7 서비스 날짜, MONTH는 최근 30 서비스 날짜 윈도우를 전달한다")
    void periodFilter_weekAndMonth_windows() {
        stubHistory(List.of());

        service.getMyCreditTransactions(MEMBER_ID, null, "WEEK", null, null);
        verify(creditTransactionRepository).findHistory(
                eq(MEMBER_ID), anyBoolean(), any(), anyBoolean(), any(),
                eq(true), eq(kst(2026, 7, 28, 4, 0)), eq(kst(2026, 8, 4, 4, 0)),
                anyBoolean(), any(), any(), any());

        service.getMyCreditTransactions(MEMBER_ID, null, "MONTH", null, null);
        verify(creditTransactionRepository).findHistory(
                eq(MEMBER_ID), anyBoolean(), any(), anyBoolean(), any(),
                eq(true), eq(kst(2026, 7, 5, 4, 0)), eq(kst(2026, 8, 4, 4, 0)),
                anyBoolean(), any(), any(), any());
    }

    @Test
    @DisplayName("조회 결과가 limit을 초과하면 초과분을 잘라내고 마지막 항목 기준 nextCursor를 발급한다")
    void hasNextPage_issuesNextCursor() {
        Instant lastCreatedAt = Instant.parse("2026-08-03T01:00:00Z");
        // limit=2 → limit+1(3)건 반환. 3번째는 다음 페이지 존재 신호.
        List<CreditTransaction> transactions = List.of(
                tx(3L, CreditTransactionType.VIDEO_VIEWED, -3, 12, NOW),
                tx(2L, CreditTransactionType.WELCOME_BONUS, 10, 15, lastCreatedAt),
                tx(1L, CreditTransactionType.VIDEO_VIEWED, -3, 5, NOW));
        stubHistory(transactions);

        CreditTransactionListResponse response =
                service.getMyCreditTransactions(MEMBER_ID, null, null, null, "2");

        assertThat(response.items()).hasSize(2);
        assertThat(response.nextCursor()).isNotNull();
        CreditTransactionCursor decoded = CreditTransactionCursor.decode(response.nextCursor());
        assertThat(decoded.createdAt()).isEqualTo(lastCreatedAt);
        assertThat(decoded.id()).isEqualTo(2L);
    }

    @Test
    @DisplayName("커서를 전달하면 커서 조건을 켜고 디코딩한 (createdAt, id)로 커서 이후 페이지를 조회한다")
    void withCursor_queriesAfterCursor() {
        Instant cursorCreatedAt = Instant.parse("2026-08-03T01:00:00Z");
        String cursor = new CreditTransactionCursor(cursorCreatedAt, 99L).encode();
        stubHistory(List.of());

        service.getMyCreditTransactions(MEMBER_ID, null, null, cursor, "20");

        verify(creditTransactionRepository).findHistory(
                eq(MEMBER_ID), anyBoolean(), any(), anyBoolean(), any(),
                anyBoolean(), any(), any(), eq(true), eq(cursorCreatedAt), eq(99L), any());
    }

    @Test
    @DisplayName("description은 거래 type의 서버 표시 문구를 반환한다")
    void description_fromTypeDisplayText() {
        List<CreditTransaction> transactions = List.of(tx(1L, CreditTransactionType.VIDEO_VIEWED, -3, 12, NOW));
        stubHistory(transactions);

        List<CreditTransactionItem> items =
                service.getMyCreditTransactions(MEMBER_ID, null, null, null, null).items();

        assertThat(items.get(0).description()).isEqualTo(CreditTransactionType.VIDEO_VIEWED.getDisplayText());
        assertThat(items.get(0).amount()).isEqualTo(-3);
        assertThat(items.get(0).balanceAfter()).isEqualTo(12);
    }

    @Test
    @DisplayName("type·period 값이 올바르지 않으면 조회하지 않고 INVALID_CREDIT_FILTER로 실패한다")
    void invalidFilter_throwsInvalidCreditFilter() {
        assertError(() -> service.getMyCreditTransactions(MEMBER_ID, "WRONG", null, null, null),
                ErrorCode.INVALID_CREDIT_FILTER);
        assertError(() -> service.getMyCreditTransactions(MEMBER_ID, null, "YEAR", null, null),
                ErrorCode.INVALID_CREDIT_FILTER);

        verifyNeverQueried();
    }

    @Test
    @DisplayName("limit이 범위를 벗어나거나 숫자가 아니면 조회하지 않고 INVALID_PAGINATION으로 실패한다")
    void invalidLimit_throwsInvalidPagination() {
        assertError(() -> service.getMyCreditTransactions(MEMBER_ID, null, null, null, "0"),
                ErrorCode.INVALID_PAGINATION);
        assertError(() -> service.getMyCreditTransactions(MEMBER_ID, null, null, null, "51"),
                ErrorCode.INVALID_PAGINATION);
        assertError(() -> service.getMyCreditTransactions(MEMBER_ID, null, null, null, "abc"),
                ErrorCode.INVALID_PAGINATION);

        verifyNeverQueried();
    }

    @Test
    @DisplayName("커서 형식이 잘못되면 조회하지 않고 INVALID_PAGINATION으로 실패한다")
    void invalidCursor_throwsInvalidPagination() {
        assertError(() -> service.getMyCreditTransactions(MEMBER_ID, null, null, "not-base64!!!", null),
                ErrorCode.INVALID_PAGINATION);

        verifyNeverQueried();
    }

    @Test
    @DisplayName("토큰의 사용자가 존재하지 않으면 USER_NOT_FOUND로 실패한다")
    void userNotFound() {
        given(memberRepository.findById(MEMBER_ID)).willReturn(Optional.empty());

        assertError(() -> service.getMyCreditTransactions(MEMBER_ID, null, null, null, null),
                ErrorCode.USER_NOT_FOUND);
    }

    @Test
    @DisplayName("탈퇴한 사용자면 USER_NOT_FOUND로 실패한다")
    void withdrawnUser() {
        Member withdrawn = memberWithBalance(BALANCE);
        ReflectionTestUtils.setField(withdrawn, "deletedAt", Instant.now());
        given(memberRepository.findById(MEMBER_ID)).willReturn(Optional.of(withdrawn));

        assertError(() -> service.getMyCreditTransactions(MEMBER_ID, null, null, null, null),
                ErrorCode.USER_NOT_FOUND);
    }

    @Test
    @DisplayName("조회 중 예기치 못한 오류는 CREDIT_TRANSACTIONS_FETCH_FAILED로 처리한다")
    void fetchFailed() {
        given(creditTransactionRepository.findHistory(
                eq(MEMBER_ID), anyBoolean(), any(), anyBoolean(), any(),
                anyBoolean(), any(), any(), anyBoolean(), any(), any(), any()))
                .willThrow(new RuntimeException("db down"));

        assertError(() -> service.getMyCreditTransactions(MEMBER_ID, null, null, null, null),
                ErrorCode.CREDIT_TRANSACTIONS_FETCH_FAILED);
    }

    // ===== helpers =====

    private static Instant kst(int year, int month, int day, int hour, int minute) {
        return LocalDate.of(year, month, day).atTime(hour, minute).atZone(KST).toInstant();
    }

    private void verifyNeverQueried() {
        verify(creditTransactionRepository, never()).findHistory(
                any(), anyBoolean(), any(), anyBoolean(), any(),
                anyBoolean(), any(), any(), anyBoolean(), any(), any(), any());
        verify(memberRepository, never()).findById(any());
    }

    private void assertError(org.assertj.core.api.ThrowableAssert.ThrowingCallable callable, ErrorCode expected) {
        assertThatThrownBy(callable)
                .isInstanceOf(CustomException.class)
                .extracting(e -> ((CustomException) e).getErrorCode())
                .isEqualTo(expected);
    }

    private Member memberWithBalance(int balance) {
        Member member = Member.create("와글러", AgeGroup.TWENTIES, Gender.FEMALE);
        ReflectionTestUtils.setField(member, "creditBalance", balance);
        return member;
    }

    private CreditTransaction tx(Long id, CreditTransactionType type, int changeAmount, int balanceAfter, Instant createdAt) {
        CreditTransaction tx = mock(CreditTransaction.class);
        given(tx.getId()).willReturn(id);
        given(tx.getType()).willReturn(type);
        given(tx.getChangeAmount()).willReturn(changeAmount);
        given(tx.getBalanceAfter()).willReturn(balanceAfter);
        given(tx.getCreatedAt()).willReturn(createdAt);
        return tx;
    }
}
