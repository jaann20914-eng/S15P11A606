package com.yuhan.wagglewaggle.domain.blur.publisher;

import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJob;
import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJobType;
import com.yuhan.wagglewaggle.domain.blur.message.AiBlurRequestMessage;
import com.yuhan.wagglewaggle.global.config.RabbitConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.core.AmqpAdmin;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageDeliveryMode;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.amqp.autoconfigure.RabbitAutoConfiguration;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.util.ReflectionTestUtils;
import org.testcontainers.containers.RabbitMQContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 실제 RabbitMQ 컨테이너로 ai.blur.request 발행을 검증한다.
 * 큐 도착·본문·persistent·Publisher Confirm(ack)·mandatory 반환을 확인한다.
 */
@SpringBootTest(classes = {RabbitConfig.class, RabbitAiBlurJobPublisher.class})
@ImportAutoConfiguration(RabbitAutoConfiguration.class)
@Testcontainers
class RabbitAiBlurPublishIntegrationTest {

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

    private static final UUID PIN_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private static final String KEY = "pins/original/42/33333333-3333-3333-3333-333333333333.mp4";

    @Autowired private RabbitAiBlurJobPublisher publisher;
    @Autowired private RabbitTemplate rabbitTemplate;
    @Autowired private AmqpAdmin amqpAdmin;
    @Autowired private ConnectionFactory connectionFactory;

    @BeforeEach
    void purge() {
        amqpAdmin.purgeQueue(RabbitConfig.QUEUE, true);
        amqpAdmin.purgeQueue(RabbitConfig.DLQ, true);
    }

    private AiBlurJob job() {
        AiBlurJob job = AiBlurJob.create(PIN_ID, KEY, AiBlurJobType.INITIAL_UPLOAD);
        ReflectionTestUtils.setField(job, "requestId", UUID.randomUUID());
        return job;
    }

    @Test
    void 발행하면_큐에_persistent_메시지가_도착하고_본문이_일치한다() {
        AiBlurJob job = job();

        publisher.publish(job);

        Message received = rabbitTemplate.receive(RabbitConfig.QUEUE, 5000);
        assertThat(received).isNotNull();
        assertThat(received.getMessageProperties().getReceivedDeliveryMode())
                .isEqualTo(MessageDeliveryMode.PERSISTENT);

        // 본문(JSON) 검증: requestId/pinId/originalVideoKey/requestedAt 포함, jobType 미포함.
        String json = new String(received.getBody());
        assertThat(json).contains("\"requestId\":\"" + job.getRequestId() + "\"");
        assertThat(json).contains("\"pinId\":\"" + PIN_ID + "\"");
        assertThat(json).contains("\"originalVideoKey\":\"" + KEY + "\"");
        assertThat(json).contains("\"requestedAt\":");
        assertThat(json).doesNotContain("jobType");
    }

    @Test
    void Publisher_Confirm으로_ack를_받는다() {
        AiBlurRequestMessage message = new AiBlurRequestMessage(
                UUID.randomUUID(), PIN_ID, KEY, Instant.parse("2026-07-31T12:00:00Z"));

        Boolean confirmed = rabbitTemplate.invoke(operations -> {
            operations.convertAndSend(RabbitConfig.EXCHANGE, RabbitConfig.ROUTING_KEY, message);
            return operations.waitForConfirms(5000);
        });

        assertThat(confirmed).isTrue();
    }

    @Test
    void mandatory_라우팅_실패시_메시지가_반환된다() throws Exception {
        // config의 RabbitTemplate은 이미 ReturnsCallback을 가지므로, 검증용 별도 템플릿을 사용한다.
        RabbitTemplate template = new RabbitTemplate(connectionFactory);
        template.setMandatory(true);
        CountDownLatch returned = new CountDownLatch(1);
        template.setReturnsCallback(r -> returned.countDown());

        // 바인딩되지 않은 라우팅 키로 발행하면 mandatory 설정에 의해 반환된다.
        template.convertAndSend(RabbitConfig.EXCHANGE, "no.such.routing.key", "unroutable");

        assertThat(returned.await(5, TimeUnit.SECONDS)).isTrue();
    }
}
