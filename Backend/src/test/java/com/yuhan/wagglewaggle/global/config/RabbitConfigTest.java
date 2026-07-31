package com.yuhan.wagglewaggle.global.config;

import org.junit.jupiter.api.Test;
import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.ExchangeTypes;
import org.springframework.amqp.core.Queue;

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
}
