package com.yuhan.wagglewaggle.domain.credit.dto;

import java.util.List;

/**
 * 크레딧 내역 조회 응답 데이터.
 *
 * <p>balance는 members.credit_balance의 현재 값이며, 거래가 존재하면 가장 최근 거래의 balanceAfter와 일치한다.
 * items는 거래 시각(createdAt) 내림차순이며 결과가 없으면 빈 배열이다.
 * nextCursor는 서버가 발급한 불투명 문자열이며 다음 페이지가 없으면 null이다.
 * Front는 nextCursor 값을 해석하거나 수정하지 않고 그대로 다음 요청에 전달한다.</p>
 */
public record CreditTransactionListResponse(
        int balance,
        List<CreditTransactionItem> items,
        String nextCursor
) {
}
