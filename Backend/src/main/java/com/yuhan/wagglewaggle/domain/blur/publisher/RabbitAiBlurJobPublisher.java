package com.yuhan.wagglewaggle.domain.blur.publisher;

import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJob;
import com.yuhan.wagglewaggle.domain.blur.message.AiBlurRequestMessage;
import com.yuhan.wagglewaggle.global.config.RabbitConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.core.MessageDeliveryMode;
import org.springframework.amqp.rabbit.connection.CorrelationData;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

import java.time.Clock;

/**
 * ai.blur.request 발행 구현. AiBlurJob의 requestId·pinId·originalVideoKey와 발행 시각(UTC)을 담아 persistent 발행한다.
 * mandatory·Publisher Confirm은 RabbitTemplate 설정으로 적용된다. 발행 시 CorrelationData(id=requestId)를 실어
 * confirm(NACK)·mandatory 반환(unroutable) 콜백이 어느 작업의 실패인지 식별하고 발행 성공으로 처리하지 않도록 한다.
 * confirm/return 결과 해석·로깅은 RabbitConfig의 콜백에서 수행한다.
 * 발행 실패(브로커 장애 등)는 호출부가 정책에 맞게 처리하도록 예외를 전파한다(상태·저장은 변경하지 않는다).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RabbitAiBlurJobPublisher implements AiBlurJobPublisher {

    private final RabbitTemplate rabbitTemplate;
    private final Clock clock;

    @Override
    public void publish(AiBlurJob aiBlurJob) {
        AiBlurRequestMessage message = new AiBlurRequestMessage(
                aiBlurJob.getRequestId(),
                aiBlurJob.getPinId(),
                aiBlurJob.getOriginalVideoKey(),
                clock.instant());

        // 브로커 confirm/return이 어느 작업인지 식별할 수 있도록 requestId를 CorrelationData id로 싣는다.
        CorrelationData correlationData = new CorrelationData(aiBlurJob.getRequestId().toString());

        rabbitTemplate.convertAndSend(RabbitConfig.EXCHANGE, RabbitConfig.ROUTING_KEY, message, postProcessor -> {
            postProcessor.getMessageProperties().setDeliveryMode(MessageDeliveryMode.PERSISTENT);
            return postProcessor;
        }, correlationData);

        log.info("ai.blur.request 발행 (requestId={}, pinId={})", aiBlurJob.getRequestId(), aiBlurJob.getPinId());
    }
}
