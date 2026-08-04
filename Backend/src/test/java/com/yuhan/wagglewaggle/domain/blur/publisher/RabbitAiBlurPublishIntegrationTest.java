package com.yuhan.wagglewaggle.domain.blur.publisher;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJob;
import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJobType;
import com.yuhan.wagglewaggle.domain.blur.message.AiBlurRequestMessage;
import com.yuhan.wagglewaggle.global.config.RabbitConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.core.AmqpAdmin;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageDeliveryMode;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.QueueBuilder;
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

    /**
     * 운영 publisher(RabbitAiBlurJobPublisher) 경로로 라우팅 불가 메시지를 발행하면,
     * RabbitConfig의 confirm 콜백이 이를 발행 성공이 아니라 실패로 인식해 requestId와 함께 ERROR로 남기는지 검증한다.
     * (기존 confirm 테스트는 waitForConfirms를 직접 호출해 운영 publisher의 콜백 처리를 검증하지 못했다.)
     */
    @Test
    void 운영_publisher로_라우팅_불가_메시지를_발행하면_confirm_콜백이_발행_실패로_처리한다() throws Exception {
        Logger rabbitConfigLogger = (Logger) LoggerFactory.getLogger(RabbitConfig.class);
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        rabbitConfigLogger.addAppender(appender);
        try {
            // 요청 큐를 삭제해 ai.blur.request 라우팅 키에 바인딩된 큐가 없게 만든다(라우팅 불가 유도).
            amqpAdmin.deleteQueue(RabbitConfig.QUEUE);

            AiBlurJob job = job();
            publisher.publish(job); // 운영 publisher 경로(mandatory + CorrelationData) 발행

            // confirm/return 콜백은 비동기다. requestId를 담은 '발행 실패' ERROR 로그가 뜰 때까지 폴링한다.
            String requestId = job.getRequestId().toString();
            assertThat(awaitFailureLog(appender, requestId, 5000))
                    .as("운영 publisher 발행의 unroutable을 confirm 콜백이 requestId와 함께 실패로 로깅해야 한다")
                    .isTrue();
        } finally {
            rabbitConfigLogger.detachAppender(appender);
            restoreRequestQueue(); // 다른 테스트를 위해 큐·바인딩 복구
        }
    }

    /** 지정한 requestId를 포함한 '발행 실패' ERROR 로그가 나타날 때까지 최대 timeoutMs 동안 폴링한다. */
    private boolean awaitFailureLog(ListAppender<ILoggingEvent> appender, String requestId, long timeoutMs)
            throws InterruptedException {
        long deadline = System.currentTimeMillis() + timeoutMs;
        while (System.currentTimeMillis() < deadline) {
            boolean found = appender.list.stream().anyMatch(event ->
                    event.getLevel() == Level.ERROR
                            && event.getFormattedMessage().contains(requestId)
                            && event.getFormattedMessage().contains("발행 실패"));
            if (found) {
                return true;
            }
            Thread.sleep(100);
        }
        return false;
    }

    /** 삭제한 요청 큐와 바인딩을 원래 계약대로 복구한다(DLX 인자 포함). */
    private void restoreRequestQueue() {
        Queue queue = QueueBuilder.durable(RabbitConfig.QUEUE)
                .withArgument("x-dead-letter-exchange", RabbitConfig.DLX)
                .withArgument("x-dead-letter-routing-key", RabbitConfig.DLQ_ROUTING_KEY)
                .build();
        amqpAdmin.declareQueue(queue);
        amqpAdmin.declareBinding(BindingBuilder.bind(queue)
                .to(new DirectExchange(RabbitConfig.EXCHANGE)).with(RabbitConfig.ROUTING_KEY));
    }
}
