package com.yuhan.wagglewaggle.domain.chat.publisher;

import com.yuhan.wagglewaggle.domain.chat.entity.AiChatJobStatus;
import com.yuhan.wagglewaggle.domain.chat.repository.AiChatJobRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.amqp.rabbit.connection.CorrelationData;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * 채팅 발행 Publisher Confirm 처리기. 브로커 수신 ack(ack=true)를 받으면 해당 작업(requestId)을 PENDING→PROCESSING으로 전환한다.
 * CorrelationData의 id에 발행 시 실은 requestId 문자열이 담겨 있어 이를 키로 작업을 식별한다.
 * ack=false(NACK)/식별 불가 시 상태를 바꾸지 않는다(발행 미도달 작업은 PENDING으로 남아 후속 재발행 대상이 될 수 있다).
 * 이 빈이 컨텍스트에 올라오면 AiChatRabbitConfig의 ObjectProvider가 이를 해석해 confirm 콜백이 상태 갱신으로 연결된다.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AiChatJobConfirmHandlerImpl implements AiChatPublishConfirmHandler {

    private final AiChatJobRepository aiChatJobRepository;

    @Override
    @Transactional
    public void onConfirm(CorrelationData correlationData, boolean ack) {
        if (!ack) {
            String id = correlationData != null ? correlationData.getId() : null;
            log.warn("ai.chat 발행 Publisher Confirm NACK - 상태 전환 스킵(PENDING 유지) (correlationId={})", id);
            return;
        }
        if (correlationData == null || correlationData.getId() == null) {
            log.warn("ai.chat Confirm ack에 correlationData가 없어 상태 전환을 스킵한다");
            return;
        }

        UUID requestId;
        try {
            requestId = UUID.fromString(correlationData.getId());
        } catch (IllegalArgumentException e) {
            log.warn("ai.chat Confirm correlationId를 UUID로 파싱할 수 없어 스킵한다 (id={})", correlationData.getId());
            return;
        }

        aiChatJobRepository.findById(requestId).ifPresentOrElse(job -> {
            if (job.getStatus() == AiChatJobStatus.PENDING) {
                job.markProcessing();
                log.info("ai.chat 발행 확인 - 작업 PROCESSING 전환 (requestId={})", requestId);
            } else {
                log.debug("ai.chat 이미 처리된 작업 - 상태 전환 스킵 (requestId={}, status={})", requestId, job.getStatus());
            }
        }, () -> log.warn("ai.chat Confirm 대상 작업을 찾을 수 없음 (requestId={})", requestId));
    }
}
