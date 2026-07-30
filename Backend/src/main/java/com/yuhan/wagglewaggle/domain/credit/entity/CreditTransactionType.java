package com.yuhan.wagglewaggle.domain.credit.entity;

/**
 * 크레딧 거래 유형. ERD의 credit_transaction_type 정의를 따른다.
 * 온보딩(가입) 초기 지급은 WELCOME_BONUS 를 사용한다.
 */
public enum CreditTransactionType {
    WELCOME_BONUS,
    PIN_EVALUATION_PARTICIPATED,
    RECEIVED_CHAT_REQUEST_ACCEPTED,
    SENT_CHAT_REQUEST_ACCEPTED,
    VIDEO_VIEWED,
    RECEIVED_HELPFUL_PIN_EVALUATION,
    RECEIVED_DISAPPOINTING_PIN_EVALUATION
}
