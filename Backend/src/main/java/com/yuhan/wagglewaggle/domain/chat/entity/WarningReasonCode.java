package com.yuhan.wagglewaggle.domain.chat.entity;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * 채팅 경고 사유 코드. DB에는 chat_warnings.reason_code VARCHAR(50)에 문자열(name())로 저장한다.
 * message는 클라이언트에 내려보내는 사용자 안내 문구로, 경고 이벤트(content)에 사용한다.
 */
@Getter
@RequiredArgsConstructor
public enum WarningReasonCode {

    EXTERNAL_MESSENGER_INDUCEMENT(
            "외부 메신저로 대화를 유도하는 패턴이 감지되었습니다. 앱 밖에서의 연락·거래는 보호받기 어려우니 주의해 주세요."),
    FRAUD_SCAM(
            "사기 위험이 의심되는 대화가 감지되었습니다. 계좌이체, 선입금 또는 외부 결제 요청에 응하기 전에 거래 정보를 다시 확인해 주세요."),
    ILLEGAL_GOODS_TRADE(
            "불법 물품 거래가 의심되는 대화가 감지되었습니다. 관련 거래는 법적 처벌 대상이 될 수 있으니 유의해 주세요."),
    ETC_SUSPICIOUS(
            "의심스러운 대화 패턴이 감지되었습니다. 거래 상대와 대화 내용을 다시 한번 확인해 주세요.");

    private final String message;
}
