package com.yuhan.wagglewaggle.domain.blur.publisher;

import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJob;
import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJobType;
import com.yuhan.wagglewaggle.domain.blur.message.AiBlurRequestMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageDeliveryMode;
import org.springframework.amqp.core.MessagePostProcessor;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.JacksonJsonMessageConverter;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class RabbitAiBlurJobPublisherTest {

    @Mock private RabbitTemplate rabbitTemplate;
    @Captor private ArgumentCaptor<AiBlurRequestMessage> messageCaptor;
    @Captor private ArgumentCaptor<MessagePostProcessor> postProcessorCaptor;

    private RabbitAiBlurJobPublisher publisher;

    private static final Instant NOW = Instant.parse("2026-07-31T12:00:00Z");
    private static final UUID REQUEST_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID PIN_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private static final String KEY = "pins/original/42/33333333-3333-3333-3333-333333333333.mp4";

    @BeforeEach
    void setUp() {
        Clock fixedClock = Clock.fixed(NOW, ZoneOffset.UTC);
        publisher = new RabbitAiBlurJobPublisher(rabbitTemplate, fixedClock);
    }

    private AiBlurJob job() {
        AiBlurJob job = AiBlurJob.create(PIN_ID, KEY, AiBlurJobType.INITIAL_UPLOAD);
        ReflectionTestUtils.setField(job, "requestId", REQUEST_ID);
        return job;
    }

    @Test
    void 지정한_Exchange와_RoutingKey로_메시지_본문을_발행한다() {
        publisher.publish(job());

        verify(rabbitTemplate).convertAndSend(
                eq("ai.blur.exchange"), eq("ai.blur.request"),
                messageCaptor.capture(), postProcessorCaptor.capture());

        AiBlurRequestMessage message = messageCaptor.getValue();
        assertThat(message.requestId()).isEqualTo(REQUEST_ID);
        assertThat(message.pinId()).isEqualTo(PIN_ID);
        assertThat(message.originalVideoKey()).isEqualTo(KEY);
        assertThat(message.requestedAt()).isEqualTo(NOW);
    }

    @Test
    void 메시지는_persistent로_발행된다() throws Exception {
        publisher.publish(job());
        verify(rabbitTemplate).convertAndSend(
                eq("ai.blur.exchange"), eq("ai.blur.request"),
                messageCaptor.capture(), postProcessorCaptor.capture());

        Message processed = postProcessorCaptor.getValue()
                .postProcessMessage(new Message("body".getBytes(), new MessageProperties()));

        assertThat(processed.getMessageProperties().getDeliveryMode())
                .isEqualTo(MessageDeliveryMode.PERSISTENT);
    }

    @Test
    void 직렬화된_본문은_UTC_ISO8601이며_jobType을_포함하지_않는다() {
        AiBlurRequestMessage message = new AiBlurRequestMessage(REQUEST_ID, PIN_ID, KEY, NOW);

        Message amqpMessage = new JacksonJsonMessageConverter()
                .toMessage(message, new MessageProperties());
        String json = new String(amqpMessage.getBody());

        assertThat(json).contains("\"requestedAt\":\"2026-07-31T12:00:00Z\"");
        assertThat(json).contains("\"requestId\":\"" + REQUEST_ID + "\"");
        assertThat(json).contains("\"pinId\":\"" + PIN_ID + "\"");
        assertThat(json).doesNotContain("jobType");
    }
}
