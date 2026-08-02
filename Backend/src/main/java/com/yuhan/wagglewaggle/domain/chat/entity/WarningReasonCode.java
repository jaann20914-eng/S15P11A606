package com.yuhan.wagglewaggle.domain.chat.entity;

/**
 * 채팅 경고 사유 코드. DB에는 chat_warnings.reason_code VARCHAR(50)에 문자열로 저장한다.
 */
public enum WarningReasonCode {
    EXTERNAL_MESSENGER_INDUCEMENT,
    FRAUD_SCAM,
    ILLEGAL_GOODS_TRADE,
    ETC_SUSPICIOUS
}
