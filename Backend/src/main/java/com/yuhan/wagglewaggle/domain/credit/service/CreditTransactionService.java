package com.yuhan.wagglewaggle.domain.credit.service;

import com.yuhan.wagglewaggle.domain.credit.dto.CreditPeriodFilter;
import com.yuhan.wagglewaggle.domain.credit.dto.CreditTransactionItem;
import com.yuhan.wagglewaggle.domain.credit.dto.CreditTransactionListResponse;
import com.yuhan.wagglewaggle.domain.credit.dto.CreditTypeFilter;
import com.yuhan.wagglewaggle.domain.credit.entity.CreditTransaction;
import com.yuhan.wagglewaggle.domain.credit.repository.CreditTransactionRepository;
import com.yuhan.wagglewaggle.domain.user.entity.Member;
import com.yuhan.wagglewaggle.domain.user.repository.MemberRepository;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

/**
 * 크레딧 내역 조회 서비스.
 * 현재 인증 사용자의 크레딧 잔액과 거래 원장을 유형·기간 필터로 커서 페이지네이션 조회한다.
 * 잔액(balance)은 members.credit_balance의 현재 값이며, 거래가 있으면 가장 최근 거래의 balanceAfter와 일치한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CreditTransactionService {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    /** 서비스 날짜 경계: 매일 04시(KST). 04시 이전이면 전날의 서비스 날짜를 사용한다. */
    private static final int SERVICE_DAY_BOUNDARY_HOUR = 4;
    private static final int DEFAULT_LIMIT = 20;
    private static final int MIN_LIMIT = 1;
    private static final int MAX_LIMIT = 50;

    private final MemberRepository memberRepository;
    private final CreditTransactionRepository creditTransactionRepository;
    private final Clock clock;

    /**
     * 크레딧 잔액과 거래 내역을 조회한다.
     * 필터(type·period)·페이지 조건(cursor·limit) 검증은 조회 이전에 수행하며, 잘못되면 조회하지 않고
     * 각각 INVALID_CREDIT_FILTER·INVALID_PAGINATION으로 실패한다.
     * 토큰의 사용자가 없거나 탈퇴 상태면 USER_NOT_FOUND, 잔액·원장 조회 중 예기치 못한 오류는
     * CREDIT_TRANSACTIONS_FETCH_FAILED로 처리한다(부분 내역을 반환하지 않는다).
     */
    @Transactional(readOnly = true)
    public CreditTransactionListResponse getMyCreditTransactions(
            Long memberId, String typeRaw, String periodRaw, String cursorRaw, String limitRaw) {
        // 조회 조건 검증은 조회 이전에 수행한다(잘못되면 잔액·목록을 조회하지 않는다).
        CreditTypeFilter typeFilter = CreditTypeFilter.from(typeRaw);
        CreditPeriodFilter periodFilter = CreditPeriodFilter.from(periodRaw);
        int limit = parseLimit(limitRaw);
        CreditTransactionCursor cursor = parseCursor(cursorRaw);

        Instant start = periodStart(periodFilter);
        Instant endExclusive = periodEndExclusive(periodFilter);

        try {
            // 토큰의 사용자가 존재하고 탈퇴하지 않았을 때만 조회한다. balance는 이 회원의 현재 잔액이다.
            Member member = memberRepository.findById(memberId)
                    .filter(m -> m.getDeletedAt() == null)
                    .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));

            // 다음 페이지 존재 여부 판단을 위해 limit + 1건을 조회한다.
            Pageable pageable = PageRequest.of(0, limit + 1);
            List<CreditTransaction> transactions = creditTransactionRepository.findHistory(
                    memberId,
                    typeFilter.getMinChangeAmount(),
                    typeFilter.getMaxChangeAmount(),
                    start,
                    endExclusive,
                    cursor == null ? null : cursor.createdAt(),
                    cursor == null ? null : cursor.id(),
                    pageable);

            return buildResponse(member.getCreditBalance(), transactions, limit);
        } catch (CustomException e) {
            // USER_NOT_FOUND 등 도메인 오류는 그대로 전파한다.
            throw e;
        } catch (Exception e) {
            log.error("크레딧 내역 조회 실패 (memberId={})", memberId, e);
            throw new CustomException(ErrorCode.CREDIT_TRANSACTIONS_FETCH_FAILED);
        }
    }

    /**
     * limit을 파싱·검증한다. 미전달(null·공백)은 기본값 20, 1~50 범위를 벗어나거나 숫자가 아니면 INVALID_PAGINATION으로 실패한다.
     */
    private int parseLimit(String raw) {
        if (raw == null || raw.isBlank()) {
            return DEFAULT_LIMIT;
        }
        int limit;
        try {
            limit = Integer.parseInt(raw.trim());
        } catch (NumberFormatException e) {
            throw new CustomException(ErrorCode.INVALID_PAGINATION);
        }
        if (limit < MIN_LIMIT || limit > MAX_LIMIT) {
            throw new CustomException(ErrorCode.INVALID_PAGINATION);
        }
        return limit;
    }

    /**
     * cursor를 파싱한다. 미전달(null·공백)은 첫 페이지(null), 형식이 잘못되면 INVALID_PAGINATION으로 실패한다.
     */
    private CreditTransactionCursor parseCursor(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        return CreditTransactionCursor.decode(raw.trim());
    }

    /**
     * 기간 필터의 시작 시각(포함)을 계산한다. ALL이면 제한이 없어 null을 반환한다.
     * 현재 서비스 날짜에서 (serviceDays - 1)일을 뺀 서비스 날짜의 04시(KST)가 시작이다.
     */
    private Instant periodStart(CreditPeriodFilter periodFilter) {
        Integer serviceDays = periodFilter.getServiceDays();
        if (serviceDays == null) {
            return null;
        }
        LocalDate startDate = currentServiceDate().minusDays(serviceDays - 1L);
        return startDate.atTime(SERVICE_DAY_BOUNDARY_HOUR, 0).atZone(KST).toInstant();
    }

    /**
     * 기간 필터의 끝 시각(미포함)을 계산한다. ALL이면 제한이 없어 null을 반환한다.
     * 현재 서비스 날짜의 다음 날 04시(KST)가 끝(exclusive)이다.
     */
    private Instant periodEndExclusive(CreditPeriodFilter periodFilter) {
        if (periodFilter.getServiceDays() == null) {
            return null;
        }
        LocalDate nextDate = currentServiceDate().plusDays(1);
        return nextDate.atTime(SERVICE_DAY_BOUNDARY_HOUR, 0).atZone(KST).toInstant();
    }

    /**
     * 현재 서비스 날짜를 계산한다. KST 시각에서 4시간을 뺀 날짜(예: KST 03:59는 전날)를 서비스 날짜로 삼는다.
     */
    private LocalDate currentServiceDate() {
        return clock.instant().atZone(KST).minusHours(SERVICE_DAY_BOUNDARY_HOUR).toLocalDate();
    }

    /**
     * limit + 1건 조회 결과에서 다음 페이지 존재 여부를 판단해 응답을 조립한다.
     * limit을 초과하면 마지막 노출 항목의 (createdAt, id)로 nextCursor를 발급하고, 아니면 nextCursor는 null이다.
     * description은 거래 type의 서버 표시 문구를 사용한다.
     */
    private CreditTransactionListResponse buildResponse(int balance, List<CreditTransaction> transactions, int limit) {
        boolean hasNext = transactions.size() > limit;
        List<CreditTransaction> pageTransactions = hasNext ? transactions.subList(0, limit) : transactions;

        List<CreditTransactionItem> items = new ArrayList<>(pageTransactions.size());
        for (CreditTransaction tx : pageTransactions) {
            items.add(new CreditTransactionItem(
                    tx.getId(),
                    tx.getType(),
                    tx.getChangeAmount(),
                    tx.getBalanceAfter(),
                    tx.getType().getDisplayText(),
                    tx.getCreatedAt()));
        }

        String nextCursor = null;
        if (hasNext) {
            CreditTransaction last = pageTransactions.get(pageTransactions.size() - 1);
            nextCursor = new CreditTransactionCursor(last.getCreatedAt(), last.getId()).encode();
        }

        return new CreditTransactionListResponse(balance, items, nextCursor);
    }
}
