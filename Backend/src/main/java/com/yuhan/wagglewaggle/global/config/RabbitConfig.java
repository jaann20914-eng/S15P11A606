package com.yuhan.wagglewaggle.global.config;

import com.yuhan.wagglewaggle.global.properties.AiBlurRepublishProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.JacksonJsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

/**
 * AI 블러 요청 RabbitMQ 계약 구성.
 * ai.blur.exchange(direct) → ai.blur.request(queue, durable). 라우팅 실패·소비 실패 시 DLX(ai.blur.dlx)/DLQ로 보낸다.
 * RabbitTemplate은 mandatory 발행 + Publisher Confirm/Return 콜백을 사용한다(메시지는 persistent).
 */
@Slf4j
@Configuration
@EnableConfigurationProperties(AiBlurRepublishProperties.class)
public class RabbitConfig {

    public static final String EXCHANGE = "ai.blur.exchange";
    public static final String ROUTING_KEY = "ai.blur.request";
    public static final String QUEUE = "ai.blur.request";

    public static final String DLX = "ai.blur.dlx";
    public static final String DLQ = "ai.blur.dead-letter";
    public static final String DLQ_ROUTING_KEY = "ai.blur.dead-letter";

    @Bean
    public DirectExchange aiBlurExchange() {
        return new DirectExchange(EXCHANGE, true, false);
    }

    @Bean
    public Queue aiBlurRequestQueue() {
        return QueueBuilder.durable(QUEUE)
                .withArgument("x-dead-letter-exchange", DLX)
                .withArgument("x-dead-letter-routing-key", DLQ_ROUTING_KEY)
                .build();
    }

    @Bean
    public Binding aiBlurRequestBinding() {
        return BindingBuilder.bind(aiBlurRequestQueue()).to(aiBlurExchange()).with(ROUTING_KEY);
    }

    @Bean
    public DirectExchange aiBlurDlx() {
        return new DirectExchange(DLX, true, false);
    }

    @Bean
    public Queue aiBlurDeadLetterQueue() {
        return QueueBuilder.durable(DLQ).build();
    }

    @Bean
    public Binding aiBlurDeadLetterBinding() {
        return BindingBuilder.bind(aiBlurDeadLetterQueue()).to(aiBlurDlx()).with(DLQ_ROUTING_KEY);
    }

    @Bean
    public MessageConverter aiBlurMessageConverter() {
        // Jackson 3 기본 매퍼는 Instant를 UTC ISO-8601 문자열로 직렬화한다(WRITE_DATES_AS_TIMESTAMPS 비활성 기본).
        return new JacksonJsonMessageConverter();
    }

    @Bean
    public RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory,
                                         MessageConverter aiBlurMessageConverter) {
        RabbitTemplate rabbitTemplate = new RabbitTemplate(connectionFactory);
        rabbitTemplate.setMessageConverter(aiBlurMessageConverter);
        rabbitTemplate.setMandatory(true);
        rabbitTemplate.setConfirmCallback((correlation, ack, cause) -> {
            if (!ack) {
                log.error("RabbitMQ Publisher Confirm NACK (cause={})", cause);
            }
        });
        rabbitTemplate.setReturnsCallback(returned ->
                log.error("RabbitMQ mandatory 반환 (routingKey={}, replyText={})",
                        returned.getRoutingKey(), returned.getReplyText()));
        return rabbitTemplate;
    }

    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }
}
