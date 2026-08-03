package com.yuhan.wagglewaggle.domain.chat.dto;

import java.time.Instant;

/**
 * 메시지 생성 브로드캐스트 이벤트. {@code /topic/chat/rooms/{roomId}}로 방 구독자에게 전송한다.
 *
 * <p>기존 {@code SubscriptionErrorEvent}의 {@code eventType + data} 봉투 패턴과 일관된다.
 * 시각 필드는 프로젝트 관례대로 UTC {@link Instant}이며, Jackson 기본 설정에 의해 UTC ISO-8601
 * 문자열(Z)로 직렬화된다. 클라이언트는 이를 로컬 시간대로 변환한다.</p>
 *
 * <ul>
 *   <li>{@code createdAt} — 저장된 메시지의 생성 시각</li>
 *   <li>{@code occurredAt} — 이벤트 방출 시각</li>
 * </ul>
 */
public record ChatMessageCreatedEvent(String eventType, Long roomId, Instant occurredAt, Data data) {

    public record Data(
            Long messageId,
            Long senderId,
            String content,
            String maskedContent,
            Instant createdAt
    ) {
    }

    public static ChatMessageCreatedEvent of(
            Long roomId,
            Long messageId,
            Long senderId,
            String content,
            String maskedContent,
            Instant createdAt,
            Instant occurredAt
    ) {
        return new ChatMessageCreatedEvent(
                "MESSAGE_CREATED",
                roomId,
                occurredAt,
                new Data(messageId, senderId, content, maskedContent, createdAt));
    }
}
