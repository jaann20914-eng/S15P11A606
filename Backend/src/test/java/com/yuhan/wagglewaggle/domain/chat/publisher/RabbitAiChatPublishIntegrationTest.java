package com.yuhan.wagglewaggle.domain.chat.publisher;

import com.yuhan.wagglewaggle.domain.chat.message.AiChatAnalysisMessage;
import com.yuhan.wagglewaggle.global.config.AiChatRabbitConfig;
import com.yuhan.wagglewaggle.global.config.RabbitConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.core.AmqpAdmin;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageDeliveryMode;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.amqp.autoconfigure.RabbitAutoConfiguration;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.RabbitMQContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 실제 RabbitMQ 컨테이너로 ai.chat.message 발행을 검증한다(DB 불필요 — Rabbit 설정·발행기만 슬라이스로 로드).
 * 큐 도착·원문 본문·persistent·Publisher Confirm(ack)을 확인한다.
 * AI 서버 연동 없이 Back 발행 계약만 독립적으로 검증하기 위한 테스트다.
 */
@SpringBootTest(classes = {RabbitConfig.class, AiChatRabbitConfig.class, RabbitAiChatJobPublisher.class})
@ImportAutoConfiguration(RabbitAutoConfiguration.class)
@Testcontainers
class RabbitAiChatPublishIntegrationTest {

    @Container
    @SuppressWarnings("resource")
    static final RabbitMQContainer RABBIT = new RabbitMQContainer(
            DockerImageName.parse("rabbitmq:4-management").asCompatibleSubstituteFor("rabbitmq"));

    @DynamicPropertySource
    static void rabbitProps(DynamicPropertyRegistry registry) {
        registry.add("spring.rabbitmq.host", RABBIT::getHost);
        registry.add("spring.rabbitmq.port", RABBIT::getAmqpPort);
        registry.add("spring.rabbitmq.username", RABBIT::getAdminUsername);
        registry.add("spring.rabbitmq.password", RABBIT::getAdminPassword);
        registry.add("spring.rabbitmq.publisher-confirm-type", () -> "correlated");
        registry.add("spring.rabbitmq.publisher-returns", () -> "true");
    }

    @Autowired private RabbitAiChatJobPublisher publisher;
    @Autowired @Qualifier("aiChatRabbitTemplate") private RabbitTemplate aiChatRabbitTemplate;
    @Autowired private AmqpAdmin amqpAdmin;

    @BeforeEach
    void purge() {
        amqpAdmin.purgeQueue(AiChatRabbitConfig.QUEUE, true);
        amqpAdmin.purgeQueue(AiChatRabbitConfig.DLQ, true);
    }

    private AiChatAnalysisMessage message() {
        return new AiChatAnalysisMessage(
                UUID.randomUUID(), 1L, Instant.parse("2026-08-03T09:12:34Z"),
                List.of(
                        new AiChatAnalysisMessage.ChatMessagePayload(2L, "카카오톡으로 연락해 주세요."),
                        new AiChatAnalysisMessage.ChatMessagePayload(3L, "제 전화번호는...")));
    }

    @Test
    void 발행하면_큐에_persistent_원문_메시지가_도착한다() {
        AiChatAnalysisMessage message = message();

        publisher.publish(message);

        Message received = aiChatRabbitTemplate.receive(AiChatRabbitConfig.QUEUE, 5000);
        assertThat(received).isNotNull();
        assertThat(received.getMessageProperties().getReceivedDeliveryMode())
                .isEqualTo(MessageDeliveryMode.PERSISTENT);

        String json = new String(received.getBody(), StandardCharsets.UTF_8);
        assertThat(json).contains("\"requestId\":\"" + message.requestId() + "\"");
        assertThat(json).contains("\"roomId\":1");
        assertThat(json).contains("\"sentAt\":\"2026-08-03T09:12:34Z\"");
        assertThat(json).contains("\"content\":\"카카오톡으로 연락해 주세요.\"");
        assertThat(json).doesNotContain("messageId");
    }

    @Test
    void Publisher_Confirm으로_브로커_수신_ack를_받는다() {
        AiChatAnalysisMessage message = message();

        Boolean confirmed = aiChatRabbitTemplate.invoke(operations -> {
            operations.convertAndSend(AiChatRabbitConfig.EXCHANGE, AiChatRabbitConfig.ROUTING_KEY, message);
            return operations.waitForConfirms(5000);
        });

        assertThat(confirmed).isTrue();
    }
}
