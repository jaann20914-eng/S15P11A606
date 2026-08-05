package com.yuhan.wagglewaggle.domain.chat.dto;

import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoomStatus;

import java.time.Instant;
import java.util.UUID;

/**
 * 새 채팅 요청 이벤트. 요청을 받은 사용자(recipient = 핀 소유자)의 개인 큐
 * {@code /user/queue/chat-rooms}로 전송한다.
 *
 * <p>익명 채팅 요청이 생성되면 recipient에게 push하여 채팅 요청 목록/알림이 재요청 없이 실시간
 * 갱신되게 한다. 요청자 본인에게는 보내지 않는다. 목록 갱신 이벤트({@link ChatRoomUpdatedEvent})·
 * 상태 변경 이벤트({@link ChatRoomStatusChangedEvent})와 같은 개인 큐를 쓰며 클라이언트는
 * {@code eventType}으로 분기한다.</p>
 *
 * <p>{@link ChatRoomStatusChangedEvent}와 동일한 {@code eventType + occurredAt + data} 봉투 패턴을
 * 따른다. 시각 필드는 프로젝트 관례대로 UTC {@link Instant}이며 Jackson 기본 설정으로 ISO-8601(Z)
 * 문자열로 직렬화된다. {@code status}는 프론트 요약 상태가 아니라 원본 {@link ChatRoomStatus}를 그대로
 * 싣는다(새 요청은 항상 PENDING).</p>
 *
 * <ul>
 *   <li>{@code requesterId} — 채팅을 요청한 사용자 id</li>
 *   <li>{@code requesterNickname} — 요청자 닉네임(요청 목록/알림 표시용)</li>
 *   <li>{@code placeName} — 대상 핀의 장소명(요청 맥락 표시용)</li>
 *   <li>{@code status} — 생성 시 상태(PENDING)</li>
 *   <li>{@code requestedAt} — 채팅 요청 시각</li>
 *   <li>{@code occurredAt} — 이벤트 방출 시각</li>
 * </ul>
 */
public record ChatRoomRequestedEvent(String eventType, Instant occurredAt, Data data) {

    public record Data(
            Long roomId,
            Long requesterId,
            String requesterNickname,
            UUID pinId,
            String placeName,
            ChatRoomStatus status,
            Instant requestedAt
    ) {
    }

    public static ChatRoomRequestedEvent of(
            Long roomId,
            Long requesterId,
            String requesterNickname,
            UUID pinId,
            String placeName,
            ChatRoomStatus status,
            Instant requestedAt,
            Instant occurredAt
    ) {
        return new ChatRoomRequestedEvent(
                "CHAT_ROOM_REQUESTED",
                occurredAt,
                new Data(roomId, requesterId, requesterNickname, pinId, placeName, status, requestedAt));
    }
}
