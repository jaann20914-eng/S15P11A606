package com.yuhan.wagglewaggle.domain.blur.consumer;

import com.rabbitmq.client.Channel;
import com.yuhan.wagglewaggle.domain.blur.message.AiBlurResultMessage;
import com.yuhan.wagglewaggle.domain.blur.service.AiBlurResultOutcome;
import com.yuhan.wagglewaggle.domain.blur.service.AiBlurResultService;
import com.yuhan.wagglewaggle.global.config.RabbitConfig;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.support.AmqpHeaders;
import org.springframework.messaging.handler.annotation.Header;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.UUID;

/**
 * ai.blur.result 결과 메시지 Consumer.
 *
 * <p>처리 순서: 수신 → (역직렬화는 컨테이너가 파라미터 타입으로 수행) → 결과 반영 서비스 호출
 * → 트랜잭션 서비스가 정상 반환(=DB 커밋)된 뒤에만 ACK한다.
 *
 * <p>Listener는 ACK/NACK 결정만 담당하고 상태 반영·검증은 {@link AiBlurResultService}에 위임한다.
 * 처리 불가·실패 메시지는 requeue 없이 NACK하여 DLQ(ai.blur.dead-letter)로 보낸다(자동 재시도 큐 없음).
 *
 * <p>DB 커밋 전에는 ACK하지 않는다. requestId → AiBlurJob → 저장된 pinId → Pin 순서로 처리하며,
 * 메시지의 pinId로 Pin을 직접 조회하지 않는다(서비스에서 보장).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AiBlurResultListener {

    private final AiBlurResultService aiBlurResultService;

    @RabbitListener(queues = RabbitConfig.RESULT_QUEUE, containerFactory = "aiBlurResultListenerContainerFactory")
    public void onMessage(AiBlurResultMessage message, Channel channel,
                          @Header(AmqpHeaders.DELIVERY_TAG) long deliveryTag) throws IOException {
        try {
            AiBlurResultOutcome outcome = aiBlurResultService.apply(message);
            if (isAckable(outcome)) {
                channel.basicAck(deliveryTag, false);
                log.info("ai.blur.result ACK (requestId={}, outcome={})", requestIdOf(message), outcome);
            } else {
                log.warn("ai.blur.result 처리 불가 → DLQ (requestId={}, outcome={})", requestIdOf(message), outcome);
                channel.basicNack(deliveryTag, false, false);
            }
        } catch (Exception e) {
            // 검증 위반(CustomException)·DB/트랜잭션 실패 등. 재시도 없이 DLQ로 보낸다.
            log.error("ai.blur.result 처리 실패 → DLQ (requestId={})", requestIdOf(message), e);
            channel.basicNack(deliveryTag, false, false);
        }
    }

    /**
     * ACK 대상: 정상 반영(APPLIED)과 이미 정상 처리된 동일 결과(DUPLICATE).
     * 그 외(JOB_NOT_FOUND·UNSUPPORTED_JOB_TYPE·OBJECT_NOT_FOUND·CONFLICT)는 NACK → DLQ.
     */
    private boolean isAckable(AiBlurResultOutcome outcome) {
        return outcome == AiBlurResultOutcome.APPLIED || outcome == AiBlurResultOutcome.DUPLICATE;
    }

    private UUID requestIdOf(AiBlurResultMessage message) {
        return message == null ? null : message.requestId();
    }
}
