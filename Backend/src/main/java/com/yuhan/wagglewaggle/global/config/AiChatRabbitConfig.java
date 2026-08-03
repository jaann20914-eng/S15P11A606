package com.yuhan.wagglewaggle.global.config;

import com.yuhan.wagglewaggle.domain.chat.publisher.AiChatPublishConfirmHandler;
import com.yuhan.wagglewaggle.global.properties.AiChatAnalysisProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * AI 채팅 분석 발행 RabbitMQ 계약 구성.
 * 발행: ai.chat.exchange(direct) → ai.chat.message(queue, durable). 라우팅/소비 실패 시 ai.chat.dlx/ai.chat.dead-letter로 보낸다.
 * 결과 수신(콜백)은 이번 범위 밖(REST 콜백은 별도 티켓)이라 result 큐/리스너는 만들지 않는다.
 * 채팅 전용 RabbitTemplate(aiChatRabbitTemplate)에 Publisher Confirm 콜백을 달아 발행 도달 확인 시 상태 전환에 사용한다
 * (blur 공용 템플릿은 콜백을 로깅만 하므로, 상태 갱신 콜백을 위해 별도 템플릿을 둔다).
 * MessageConverter는 기존 빈을 재사용하고, 콜백 핸들러는 ObjectProvider로 지연 참조한다(핸들러 미존재 시 로그만).
 */
@Slf4j
@Configuration
@EnableConfigurationProperties(AiChatAnalysisProperties.class)
public class AiChatRabbitConfig {

    public static final String EXCHANGE = "ai.chat.exchange";
    public static final String ROUTING_KEY = "ai.chat.message";
    public static final String QUEUE = "ai.chat.message";

    public static final String DLX = "ai.chat.dlx";
    public static final String DLQ = "ai.chat.dead-letter";
    public static final String DLQ_ROUTING_KEY = "ai.chat.dead-letter";

    @Bean
    public DirectExchange aiChatExchange() {
        return new DirectExchange(EXCHANGE, true, false);
    }

    @Bean
    public Queue aiChatMessageQueue() {
        return QueueBuilder.durable(QUEUE)
                .withArgument("x-dead-letter-exchange", DLX)
                .withArgument("x-dead-letter-routing-key", DLQ_ROUTING_KEY)
                .build();
    }

    @Bean
    public Binding aiChatMessageBinding() {
        return BindingBuilder.bind(aiChatMessageQueue()).to(aiChatExchange()).with(ROUTING_KEY);
    }

    @Bean
    public DirectExchange aiChatDlx() {
        return new DirectExchange(DLX, true, false);
    }

    @Bean
    public Queue aiChatDeadLetterQueue() {
        return QueueBuilder.durable(DLQ).build();
    }

    @Bean
    public Binding aiChatDeadLetterBinding() {
        return BindingBuilder.bind(aiChatDeadLetterQueue()).to(aiChatDlx()).with(DLQ_ROUTING_KEY);
    }

    /**
     * 채팅 발행 전용 RabbitTemplate. MessageConverter는 기존 빈을 재사용한다.
     * Publisher Confirm(ack) 수신 시 등록된 핸들러에 위임하며, 핸들러가 없으면(Stage 1) 로그만 남긴다.
     */
    @Bean
    public RabbitTemplate aiChatRabbitTemplate(ConnectionFactory connectionFactory,
                                               MessageConverter messageConverter,
                                               ObjectProvider<AiChatPublishConfirmHandler> confirmHandlerProvider) {
        RabbitTemplate rabbitTemplate = new RabbitTemplate(connectionFactory);
        rabbitTemplate.setMessageConverter(messageConverter);
        rabbitTemplate.setMandatory(true);
        rabbitTemplate.setConfirmCallback((correlationData, ack, cause) -> {
            AiChatPublishConfirmHandler handler = confirmHandlerProvider.getIfAvailable();
            if (handler != null) {
                handler.onConfirm(correlationData, ack);
            } else if (!ack) {
                log.error("ai.chat 발행 Publisher Confirm NACK (cause={})", cause);
            }
        });
        rabbitTemplate.setReturnsCallback(returned ->
                log.error("ai.chat mandatory 반환 (routingKey={}, replyText={})",
                        returned.getRoutingKey(), returned.getReplyText()));
        return rabbitTemplate;
    }
}
