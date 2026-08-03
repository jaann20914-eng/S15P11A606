package com.yuhan.wagglewaggle.domain.chat.dto;

import com.yuhan.wagglewaggle.domain.chat.entity.WarningReasonCode;

import java.time.Instant;

/**
 * 위험 패턴 감지 경고 브로드캐스트 이벤트. {@code /topic/chat/rooms/{roomId}}로 방 구독자 전체에게 전송한다.
 * 메시지를 차단·수정·삭제하지 않고 시스템 경고만 알린다.
 *
 * <p>{@code ChatMessageCreatedEvent}와 동일한 {@code eventType + roomId + occurredAt + data} 봉투를 따른다.</p>
 * <ul>
 *   <li>{@code data.content} — reasonCode에 매핑된 사용자 안내 문구</li>
 *   <li>{@code data.createdAt} — 저장된 ChatWarning 생성 시각</li>
 *   <li>{@code occurredAt} — 이벤트 방출 시각</li>
 * </ul>
 */
public record ChatWarningEvent(String eventType, Long roomId, Instant occurredAt, Data data) {

    public record Data(
            WarningReasonCode reasonCode,
            String content,
            Instant createdAt
    ) {
    }

    public static ChatWarningEvent of(
            Long roomId,
            WarningReasonCode reasonCode,
            String content,
            Instant createdAt,
            Instant occurredAt
    ) {
        return new ChatWarningEvent(
                "WARNING_CREATED",
                roomId,
                occurredAt,
                new Data(reasonCode, content, createdAt));
    }
}
