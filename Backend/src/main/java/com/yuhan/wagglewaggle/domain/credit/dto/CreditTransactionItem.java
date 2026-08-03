package com.yuhan.wagglewaggle.domain.credit.dto;

import com.yuhan.wagglewaggle.domain.credit.entity.CreditTransactionType;

import java.time.Instant;

/**
 * 크레딧 거래 내역의 단일 항목.
 *
 * <p>amount는 증감 크레딧(적립 양수·사용 음수), balanceAfter는 해당 거래를 반영한 직후의 원장 잔액이다.
 * description은 거래 type에 대응하는 서버 표시 문구({@link CreditTransactionType#getDisplayText()})다.
 * createdAt은 UTC 기반 ISO-8601(Instant)로 전달하고 timezone 변환은 클라이언트에서 처리한다.</p>
 */
public record CreditTransactionItem(
        Long transactionId,
        CreditTransactionType type,
        int amount,
        int balanceAfter,
        String description,
        Instant createdAt
) {
}
