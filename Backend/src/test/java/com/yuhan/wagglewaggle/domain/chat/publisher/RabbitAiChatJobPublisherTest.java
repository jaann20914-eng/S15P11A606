package com.yuhan.wagglewaggle.domain.chat.publisher;

import com.yuhan.wagglewaggle.domain.chat.message.AiChatAnalysisMessage;
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
import org.springframework.amqp.rabbit.connection.CorrelationData;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.JacksonJsonMessageConverter;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class RabbitAiChatJobPublisherTest {

    @Mock private RabbitTemplate aiChatRabbitTemplate;
    @Captor private ArgumentCaptor<AiChatAnalysisMessage> messageCaptor;
    @Captor private ArgumentCaptor<MessagePostProcessor> postProcessorCaptor;
    @Captor private ArgumentCaptor<CorrelationData> correlationCaptor;

    private RabbitAiChatJobPublisher publisher;

    private static final Instant SENT_AT = Instant.parse("2026-08-03T09:12:34Z");
    private static final UUID REQUEST_ID = UUID.fromString("4f7c19da-b64d-4bf5-8a9c-7689e59566ac");

    @BeforeEach
    void setUp() {
        publisher = new RabbitAiChatJobPublisher(aiChatRabbitTemplate);
    }

    private AiChatAnalysisMessage message() {
        return new AiChatAnalysisMessage(REQUEST_ID, 1L, SENT_AT, List.of(
                new AiChatAnalysisMessage.ChatMessagePayload(2L, "카카오톡으로 연락해 주세요."),
                new AiChatAnalysisMessage.ChatMessagePayload(3L, "제 전화번호는...")));
    }

    @Test
    void 지정한_Exchange와_RoutingKey로_배치_본문을_발행한다() {
        publisher.publish(message());

        verify(aiChatRabbitTemplate).convertAndSend(
                eq("ai.chat.exchange"), eq("ai.chat.message"),
                messageCaptor.capture(), postProcessorCaptor.capture(), correlationCaptor.capture());

        AiChatAnalysisMessage sent = messageCaptor.getValue();
        assertThat(sent.requestId()).isEqualTo(REQUEST_ID);
        assertThat(sent.roomId()).isEqualTo(1L);
        assertThat(sent.sentAt()).isEqualTo(SENT_AT);
        assertThat(sent.chatMessages()).hasSize(2);
        assertThat(sent.chatMessages().get(0).senderId()).isEqualTo(2L);
        assertThat(sent.chatMessages().get(0).content()).isEqualTo("카카오톡으로 연락해 주세요.");
    }

    @Test
    void CorrelationData에_requestId를_실어_발행한다() {
        publisher.publish(message());

        verify(aiChatRabbitTemplate).convertAndSend(
                eq("ai.chat.exchange"), eq("ai.chat.message"),
                messageCaptor.capture(), postProcessorCaptor.capture(), correlationCaptor.capture());

        assertThat(correlationCaptor.getValue().getId()).isEqualTo(REQUEST_ID.toString());
    }

    @Test
    void 메시지는_persistent로_발행된다() throws Exception {
        publisher.publish(message());

        verify(aiChatRabbitTemplate).convertAndSend(
                eq("ai.chat.exchange"), eq("ai.chat.message"),
                messageCaptor.capture(), postProcessorCaptor.capture(), correlationCaptor.capture());

        Message processed = postProcessorCaptor.getValue()
                .postProcessMessage(new Message("body".getBytes(), new MessageProperties()));

        assertThat(processed.getMessageProperties().getDeliveryMode())
                .isEqualTo(MessageDeliveryMode.PERSISTENT);
    }

    @Test
    void 직렬화된_본문은_원문_content와_UTC_sentAt를_포함하고_messageId는_없다() {
        Message amqpMessage = new JacksonJsonMessageConverter()
                .toMessage(message(), new MessageProperties());
        String json = new String(amqpMessage.getBody(), StandardCharsets.UTF_8);

        assertThat(json).contains("\"requestId\":\"" + REQUEST_ID + "\"");
        assertThat(json).contains("\"sentAt\":\"2026-08-03T09:12:34Z\"");
        assertThat(json).contains("\"content\":\"카카오톡으로 연락해 주세요.\"");
        assertThat(json).doesNotContain("messageId");
    }
}
