package com.yuhan.wagglewaggle.global.config;

import com.yuhan.wagglewaggle.global.properties.AiBlurRepublishProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.core.AcknowledgeMode;
import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
import org.springframework.amqp.rabbit.annotation.EnableRabbit;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.JacksonJsonMessageConverter;
import org.springframework.amqp.support.converter.MessageConverter;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

/**
 * AI 블러 RabbitMQ 계약 구성.
 * 요청: ai.blur.exchange(direct) → ai.blur.request(queue, durable).
 * 결과: 같은 ai.blur.exchange(direct) → ai.blur.result(queue, durable), routingKey=ai.blur.result.
 * 두 큐 모두 소비/라우팅 실패 시 공용 DLX(ai.blur.dlx)/DLQ(ai.blur.dead-letter)로 보낸다.
 * RabbitTemplate은 mandatory 발행 + Publisher Confirm/Return 콜백을 사용한다(메시지는 persistent).
 * 결과 소비는 manual ACK로 처리한다(트랜잭션 커밋 후 ACK).
 */
@Slf4j
@Configuration
@EnableRabbit
@EnableConfigurationProperties(AiBlurRepublishProperties.class)
public class RabbitConfig {

    public static final String EXCHANGE = "ai.blur.exchange";
    public static final String ROUTING_KEY = "ai.blur.request";
    public static final String QUEUE = "ai.blur.request";

    public static final String DLX = "ai.blur.dlx";
    public static final String DLQ = "ai.blur.dead-letter";
    public static final String DLQ_ROUTING_KEY = "ai.blur.dead-letter";

    // ai.blur.result 수신 계약. 큐/바인딩/리스너 선언은 결과 소비 단계에서 추가한다.
    public static final String RESULT_QUEUE = "ai.blur.result";
    public static final String RESULT_ROUTING_KEY = "ai.blur.result";

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

    // --- ai.blur.result 결과 수신 계약 ---
    // Exchange와 DLX/DLQ는 위 요청 계약의 Bean을 그대로 재사용한다(중복 생성하지 않는다).

    @Bean
    public Queue aiBlurResultQueue() {
        return QueueBuilder.durable(RESULT_QUEUE)
                .withArgument("x-dead-letter-exchange", DLX)
                .withArgument("x-dead-letter-routing-key", DLQ_ROUTING_KEY)
                .build();
    }

    @Bean
    public Binding aiBlurResultBinding() {
        return BindingBuilder.bind(aiBlurResultQueue()).to(aiBlurExchange()).with(RESULT_ROUTING_KEY);
    }

    /**
     * 결과 소비 전용 리스너 컨테이너 팩토리.
     * manual ACK로 트랜잭션 커밋 후 명시적으로 ACK/NACK한다. 처리 불가 메시지는 requeue 없이 DLQ로 보낸다.
     */
    @Bean
    public SimpleRabbitListenerContainerFactory aiBlurResultListenerContainerFactory(
            ConnectionFactory connectionFactory, MessageConverter aiBlurMessageConverter) {
        SimpleRabbitListenerContainerFactory factory = new SimpleRabbitListenerContainerFactory();
        factory.setConnectionFactory(connectionFactory);
        factory.setMessageConverter(aiBlurMessageConverter);
        factory.setAcknowledgeMode(AcknowledgeMode.MANUAL);
        // 변환 실패 등 컨테이너가 직접 거부하는 경우에도 requeue 없이 DLQ로 보낸다(자동 재시도 큐는 두지 않는다).
        factory.setDefaultRequeueRejected(false);
        return factory;
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
