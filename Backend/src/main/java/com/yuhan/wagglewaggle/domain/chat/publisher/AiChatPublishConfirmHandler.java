package com.yuhan.wagglewaggle.domain.chat.publisher;

import org.springframework.amqp.rabbit.connection.CorrelationData;

/**
 * 채팅 분석 메시지 발행에 대한 Publisher Confirm(브로커 수신 ack) 처리기.
 * 구현체는 ack 수신 시 해당 발행 작업(requestId)의 상태를 전환한다. (구현은 Stage 2)
 */
public interface AiChatPublishConfirmHandler {

    /**
     * @param correlationData 발행 시 실은 상관 데이터(id = requestId 문자열). null일 수 있다.
     * @param ack             브로커가 메시지를 수신하면 true, 거부(NACK)면 false.
     */
    void onConfirm(CorrelationData correlationData, boolean ack);
}
