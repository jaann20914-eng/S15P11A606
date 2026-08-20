package com.yuhan.wagglewaggle.global.config;

import com.yuhan.wagglewaggle.global.properties.AiBlurResultConsumerProperties;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.core.AcknowledgeMode;
import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.ExchangeTypes;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * ai.blur RabbitMQ 계약(Exchange/Queue/DLX/DLQ/바인딩) 선언 검증.
 */
class RabbitConfigTest {

    private final RabbitConfig config = new RabbitConfig();

    @Test
    void Exchange는_direct이고_durable이다() {
        DirectExchange exchange = config.aiBlurExchange();

        assertThat(exchange.getName()).isEqualTo("ai.blur.exchange");
        assertThat(exchange.getType()).isEqualTo(ExchangeTypes.DIRECT);
        assertThat(exchange.isDurable()).isTrue();
    }

    @Test
    void Queue는_durable이고_DLX_인자를_가진다() {
        Queue queue = config.aiBlurRequestQueue();

        assertThat(queue.getName()).isEqualTo("ai.blur.request");
        assertThat(queue.isDurable()).isTrue();
        assertThat(queue.getArguments())
                .containsEntry("x-dead-letter-exchange", "ai.blur.dlx")
                .containsEntry("x-dead-letter-routing-key", "ai.blur.dead-letter");
    }

    @Test
    void Queue는_RoutingKey로_Exchange에_바인딩된다() {
        Binding binding = config.aiBlurRequestBinding();

        assertThat(binding.getExchange()).isEqualTo("ai.blur.exchange");
        assertThat(binding.getRoutingKey()).isEqualTo("ai.blur.request");
        assertThat(binding.getDestination()).isEqualTo("ai.blur.request");
        assertThat(binding.getDestinationType()).isEqualTo(Binding.DestinationType.QUEUE);
    }

    @Test
    void DLX와_DLQ가_DeadLetterRoutingKey로_바인딩된다() {
        DirectExchange dlx = config.aiBlurDlx();
        Queue dlq = config.aiBlurDeadLetterQueue();
        Binding dlqBinding = config.aiBlurDeadLetterBinding();

        assertThat(dlx.getName()).isEqualTo("ai.blur.dlx");
        assertThat(dlx.isDurable()).isTrue();
        assertThat(dlq.getName()).isEqualTo("ai.blur.dead-letter");
        assertThat(dlq.isDurable()).isTrue();
        assertThat(dlqBinding.getExchange()).isEqualTo("ai.blur.dlx");
        assertThat(dlqBinding.getRoutingKey()).isEqualTo("ai.blur.dead-letter");
        assertThat(dlqBinding.getDestination()).isEqualTo("ai.blur.dead-letter");
    }

    @Test
    void 결과_Queue는_durable이고_공용_DLX_인자를_가진다() {
        Queue queue = config.aiBlurResultQueue();

        assertThat(queue.getName()).isEqualTo("ai.blur.result");
        assertThat(queue.isDurable()).isTrue();
        assertThat(queue.getArguments())
                .containsEntry("x-dead-letter-exchange", "ai.blur.dlx")
                .containsEntry("x-dead-letter-routing-key", "ai.blur.dead-letter");
    }

    @Test
    void 결과_Queue는_기존_Exchange에_ai_blur_result_RoutingKey로_바인딩된다() {
        Binding binding = config.aiBlurResultBinding();

        // 요청과 동일한 Exchange(ai.blur.exchange)를 재사용한다.
        assertThat(binding.getExchange()).isEqualTo("ai.blur.exchange");
        assertThat(binding.getRoutingKey()).isEqualTo("ai.blur.result");
        assertThat(binding.getDestination()).isEqualTo("ai.blur.result");
        assertThat(binding.getDestinationType()).isEqualTo(Binding.DestinationType.QUEUE);
    }

    @Test
    void 결과_리스너_컨테이너_팩토리는_manual_ACK이다() {
        SimpleRabbitListenerContainerFactory factory = config.aiBlurResultListenerContainerFactory(
                org.mockito.Mockito.mock(org.springframework.amqp.rabbit.connection.ConnectionFactory.class),
                config.aiBlurMessageConverter(), new AiBlurResultConsumerProperties(2, 4, 1));

        assertThat(org.springframework.test.util.ReflectionTestUtils.getField(factory, "acknowledgeMode"))
                .isEqualTo(AcknowledgeMode.MANUAL);
        assertThat(org.springframework.test.util.ReflectionTestUtils.getField(factory, "defaultRequeueRejected"))
                .isEqualTo(false);
        assertThat(org.springframework.test.util.ReflectionTestUtils.getField(factory, "concurrentConsumers"))
                .isEqualTo(2);
        assertThat(org.springframework.test.util.ReflectionTestUtils.getField(factory, "maxConcurrentConsumers"))
                .isEqualTo(4);
        assertThat(org.springframework.test.util.ReflectionTestUtils.getField(factory, "prefetchCount"))
                .isEqualTo(1);
    }
}
