package com.yuhan.wagglewaggle.domain.chat.dto;

import java.time.Instant;
import java.util.UUID;

/**
 * 채팅방 목록 갱신 이벤트. 메시지 전송 시 두 참여자의 개인 큐 {@code /user/queue/chat-rooms}로 각각 전송한다.
 *
 * <p>방 토픽({@code /topic/chat/rooms/{roomId}}) 브로드캐스트는 방 상세 화면을 구독 중인 사용자에게만
 * 도달한다. 채팅방 목록 화면만 보고 있는 참여자도 재요청 없이 최근 메시지·정렬·안읽음 상태를 갱신할 수 있도록
 * 이 이벤트를 개인 큐로 push한다.</p>
 *
 * <p>이번 메시지의 비발신 참여자(상대)에게만 push한다. 이 이벤트를 받았다는 것 자체가 상대에게 새
 * 메시지가 도착했다는 뜻이므로 안읽음 여부는 담지 않는다(클라이언트는 수신 즉시 안읽음으로 처리). 발신자
 * 본인의 목록은 SEND 성공 시점에 클라이언트가 낙관적으로 갱신한다.</p>
 *
 * <p>수신자는 room 목록({@code GET /api/v1/chat/rooms}, roomId 기반)을 볼 수도, pin 목록
 * ({@code GET /api/v1/chat/pins}, pinId 기반)을 볼 수도 있으므로 {@code roomId}와 {@code pinId}를
 * 모두 담아 어느 화면에서든 자기 항목을 찾게 한다.</p>
 *
 * <p>시각 필드는 프로젝트 관례대로 UTC {@link Instant}이며, Jackson 기본 설정에 의해 UTC ISO-8601
 * 문자열(Z)로 직렬화된다. 클라이언트가 로컬 시간대로 변환한다.</p>
 *
 * <ul>
 *   <li>{@code lastMessage} — 목록 미리보기(maskedContent 우선, 없으면 content)</li>
 *   <li>{@code lastMessageAt} — 최근 메시지 생성 시각(목록 정렬 기준)</li>
 *   <li>{@code senderId} — 표시/디버깅용(수신자 입장에선 항상 상대 id)</li>
 *   <li>{@code occurredAt} — 이벤트 방출 시각</li>
 * </ul>
 */
public record ChatRoomUpdatedEvent(String eventType, Instant occurredAt, Data data) {

    public record Data(
            UUID pinId,
            Long roomId,
            Long senderId,
            String lastMessage,
            Instant lastMessageAt
    ) {
    }

    public static ChatRoomUpdatedEvent of(
            Long roomId,
            UUID pinId,
            Long senderId,
            String lastMessage,
            Instant lastMessageAt,
            Instant occurredAt
    ) {
        return new ChatRoomUpdatedEvent(
                "CHAT_ROOM_UPDATED",
                occurredAt,
                new Data(pinId, roomId, senderId, lastMessage, lastMessageAt));
    }
}
