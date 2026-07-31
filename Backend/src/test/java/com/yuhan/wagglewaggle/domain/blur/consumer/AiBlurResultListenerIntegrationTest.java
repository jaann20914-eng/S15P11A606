package com.yuhan.wagglewaggle.domain.blur.consumer;

import com.yuhan.wagglewaggle.domain.blur.message.AiBlurResultMessage;
import com.yuhan.wagglewaggle.domain.blur.service.AiBlurResultOutcome;
import com.yuhan.wagglewaggle.domain.blur.service.AiBlurResultService;
import com.yuhan.wagglewaggle.global.config.RabbitConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.amqp.core.AmqpAdmin;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageDeliveryMode;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.amqp.autoconfigure.RabbitAutoConfiguration;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.testcontainers.containers.RabbitMQContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;

/**
 * 실제 RabbitMQ 컨테이너로 ai.blur.result 소비의 manual ACK·DLQ 라우팅을 검증한다.
 * 결과 반영 서비스는 @MockitoBean으로 대체해 Consumer↔브로커 계약(ACK/NACK, DLQ)만 확인한다.
 * 외부(AI 워커)처럼 __TypeId__ 헤더 없는 JSON을 보내 파라미터 타입 추론 역직렬화도 함께 검증한다.
 */
@SpringBootTest(classes = {RabbitConfig.class, AiBlurResultListener.class})
@ImportAutoConfiguration(RabbitAutoConfiguration.class)
@Testcontainers
class AiBlurResultListenerIntegrationTest {

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
    }

    @MockitoBean private AiBlurResultService aiBlurResultService;

    @Autowired private RabbitTemplate rabbitTemplate;
    @Autowired private AmqpAdmin amqpAdmin;

    @BeforeEach
    void purge() {
        amqpAdmin.purgeQueue(RabbitConfig.RESULT_QUEUE, true);
        amqpAdmin.purgeQueue(RabbitConfig.DLQ, true);
    }

    /** __TypeId__ 헤더 없는 외부 JSON을 ai.blur.result 라우팅 키로 발행한다. */
    private void publishResult(UUID requestId) {
        String json = """
                {"requestId":"%s","pinId":"22222222-2222-2222-2222-222222222222",\
                "processingStatus":"COMPLETED","finalStatus":"PASS",\
                "blurredVideoKey":"blurred.mp4","thumbnailKey":"thumb.jpg",\
                "completedAt":"2026-07-31T12:00:00Z"}""".formatted(requestId);
        MessageProperties props = new MessageProperties();
        props.setContentType(MessageProperties.CONTENT_TYPE_JSON);
        props.setDeliveryMode(MessageDeliveryMode.PERSISTENT);
        Message message = new Message(json.getBytes(StandardCharsets.UTF_8), props);
        rabbitTemplate.send(RabbitConfig.EXCHANGE, RabbitConfig.RESULT_ROUTING_KEY, message);
    }

    @Test
    void 정상_반영_결과는_ACK되어_DLQ로_가지_않는다() {
        given(aiBlurResultService.apply(any())).willReturn(AiBlurResultOutcome.APPLIED);
        UUID requestId = UUID.randomUUID();

        publishResult(requestId);

        // 헤더 없는 JSON이 AiBlurResultMessage로 역직렬화되어 서비스에 전달됐는지 확인한다.
        verify(aiBlurResultService, timeout(5000)).apply(any(AiBlurResultMessage.class));
        // ACK되어 결과 큐·DLQ 모두 비어 있어야 한다.
        assertThat(rabbitTemplate.receive(RabbitConfig.RESULT_QUEUE, 500)).isNull();
        assertThat(rabbitTemplate.receive(RabbitConfig.DLQ, 500)).isNull();
    }

    @Test
    void 처리_불가_결과는_requeue_없이_DLQ로_이동한다() {
        given(aiBlurResultService.apply(any())).willReturn(AiBlurResultOutcome.JOB_NOT_FOUND);

        publishResult(UUID.randomUUID());

        verify(aiBlurResultService, timeout(5000)).apply(any(AiBlurResultMessage.class));
        // NACK(requeue=false) → 공용 DLX → DLQ(ai.blur.dead-letter)로 도착해야 한다.
        Message dead = rabbitTemplate.receive(RabbitConfig.DLQ, 5000);
        assertThat(dead).isNotNull();
        // requeue되지 않으므로 원본 결과 큐는 비어 있어야 한다.
        assertThat(rabbitTemplate.receive(RabbitConfig.RESULT_QUEUE, 500)).isNull();
    }
}
