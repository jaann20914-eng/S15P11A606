package com.yuhan.wagglewaggle.domain.chat.dto;

import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoomStatus;

import java.time.Instant;
import java.util.UUID;

/**
 * 채팅방 상태 변경 이벤트. 상태를 바꾼 사람(actor)의 상대 참여자 개인 큐 {@code /user/queue/chat-rooms}로 전송한다.
 *
 * <p>채팅 요청 결정(수락/거절/나가기), 핀 삭제, 핀 떠나기로 방 상태가 바뀌면 상대(비actor)에게 push하여
 * 채팅방 목록/상태가 재요청 없이 실시간 갱신되게 한다. 목록 갱신 이벤트({@code CHAT_ROOM_UPDATED})와 같은
 * 개인 큐를 쓰며 클라이언트는 {@code eventType}으로 분기한다.</p>
 *
 * <p>{@link ChatRoomUpdatedEvent}와 동일한 {@code eventType + occurredAt + data} 봉투 패턴을 따른다.
 * 시각 필드는 프로젝트 관례대로 UTC {@link Instant}이며 Jackson 기본 설정으로 ISO-8601(Z) 문자열로
 * 직렬화된다. {@code status}는 프론트 요약 상태가 아니라 원본 {@link ChatRoomStatus}를 그대로 싣는다.</p>
 *
 * <ul>
 *   <li>{@code senderId} — 상태를 변경한 사용자(actor) id</li>
 *   <li>{@code status} — 전이 후 상태(ACTIVE/REFUSED/LEFT)</li>
 *   <li>{@code changedAt} — 상태 변경 시각</li>
 *   <li>{@code occurredAt} — 이벤트 방출 시각</li>
 * </ul>
 */
public record ChatRoomStatusChangedEvent(String eventType, Instant occurredAt, Data data) {

    public record Data(
            UUID pinId,
            Long roomId,
            Long senderId,
            ChatRoomStatus status,
            Instant changedAt
    ) {
    }

    public static ChatRoomStatusChangedEvent of(
            Long roomId,
            UUID pinId,
            Long senderId,
            ChatRoomStatus status,
            Instant changedAt,
            Instant occurredAt
    ) {
        return new ChatRoomStatusChangedEvent(
                "CHAT_ROOM_STATUS_CHANGED",
                occurredAt,
                new Data(pinId, roomId, senderId, status, changedAt));
    }
}
