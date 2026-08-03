package com.yuhan.wagglewaggle.domain.chat.message;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * ai.chat.message 메시지 본문. 한 채팅방의 미분석 메시지 묶음(윈도우) 1건을 담는다.
 * content는 마스킹 이전 원문을 전달한다(패턴 분석 정확도를 위해 마스킹 여부와 무관하게 원문 사용).
 * sentAt은 배치 발행 기준 시각 1개이며 UTC ISO-8601로 직렬화된다.
 * 멱등성 키는 requestId(=AiChatJob PK)로 처리하며, 개별 messageId는 payload에 포함하지 않는다.
 */
public record AiChatAnalysisMessage(
        UUID requestId,
        Long roomId,
        Instant sentAt,
        List<ChatMessagePayload> chatMessages
) {

    /**
     * 배치에 포함된 메시지 1건. 동일 발신자 판단을 위한 senderId와 원문 content만 싣는다.
     */
    public record ChatMessagePayload(
            Long senderId,
            String content
    ) {
    }
}
