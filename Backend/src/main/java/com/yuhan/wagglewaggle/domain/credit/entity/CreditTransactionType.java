package com.yuhan.wagglewaggle.domain.credit.entity;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 크레딧 거래 유형. ERD의 credit_transaction_type 정의를 따른다.
 * 온보딩(가입) 초기 지급은 WELCOME_BONUS 를 사용한다.
 * REVERSAL 은 적립 취소·사용 복구 시 원거래를 참조해 추가하는 반대 부호 정정 거래다.
 * displayText 는 크레딧 내역 조회 응답의 description(Front 표시용 문구)로 사용한다.
 */
@Getter
@RequiredArgsConstructor
public enum CreditTransactionType {
    WELCOME_BONUS("가입 축하 크레딧"),
    PIN_EVALUATION_PARTICIPATED("핀 평가 참여"),
    RECEIVED_CHAT_REQUEST_ACCEPTED("채팅 요청 수락"),
    SENT_CHAT_REQUEST_ACCEPTED("채팅 요청 수락"),
    VIDEO_VIEWED("영상 핀 열람"),
    RECEIVED_HELPFUL_PIN_EVALUATION("도움이 돼요 평가 수신"),
    RECEIVED_DISAPPOINTING_PIN_EVALUATION("아쉬워요 평가 수신"),
    REVERSAL("크레딧 정정");

    private final String displayText;
}
