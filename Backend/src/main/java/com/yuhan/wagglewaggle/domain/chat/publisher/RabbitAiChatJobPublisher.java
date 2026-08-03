package com.yuhan.wagglewaggle.domain.chat.publisher;

import com.yuhan.wagglewaggle.domain.chat.message.AiChatAnalysisMessage;
import com.yuhan.wagglewaggle.global.config.AiChatRabbitConfig;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.core.MessageDeliveryMode;
import org.springframework.amqp.rabbit.connection.CorrelationData;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;

/**
 * ai.chat.message 발행 구현. 배치 메시지를 persistent로 발행하며,
 * Publisher Confirm에서 발행 작업을 식별할 수 있도록 CorrelationData(id=requestId)를 함께 싣는다.
 * blur 공용 템플릿과 콜백을 분리하기 위해 채팅 전용 aiChatRabbitTemplate을 사용한다.
 * 발행 실패(브로커 장애 등)는 호출부가 정책에 맞게 처리하도록 예외를 그대로 전파한다(상태·저장은 변경하지 않는다).
 */
@Slf4j
@Component
public class RabbitAiChatJobPublisher implements AiChatJobPublisher {

    private final RabbitTemplate aiChatRabbitTemplate;

    public RabbitAiChatJobPublisher(@Qualifier("aiChatRabbitTemplate") RabbitTemplate aiChatRabbitTemplate) {
        this.aiChatRabbitTemplate = aiChatRabbitTemplate;
    }

    @Override
    public void publish(AiChatAnalysisMessage message) {
        // 브로커가 ack를 줄 때 CorrelationData로 어느 job인지 식별
        CorrelationData correlationData = new CorrelationData(message.requestId().toString());

        aiChatRabbitTemplate.convertAndSend(AiChatRabbitConfig.EXCHANGE, AiChatRabbitConfig.ROUTING_KEY, message,
                postProcessor -> {
                    // rabbitMQ 다운돼도 메세지 복구됨
                    postProcessor.getMessageProperties().setDeliveryMode(MessageDeliveryMode.PERSISTENT);
                    return postProcessor;
                }, correlationData);

        log.info("ai.chat.message 발행 (requestId={}, roomId={}, count={})",
                message.requestId(), message.roomId(), message.chatMessages().size());
    }
}
