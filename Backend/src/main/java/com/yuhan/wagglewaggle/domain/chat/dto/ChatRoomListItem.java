package com.yuhan.wagglewaggle.domain.chat.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * 채팅방 목록 조회 응답 항목. 프론트가 방마다 장소·상대방·최근 메시지·안읽음 여부를 추가 요청 없이
 * 렌더링하도록 필요한 데이터를 담는다.
 *
 * <p>{@code lastMessage}·{@code lastMessageAt}은 방에 메시지가 없으면 null이다.
 * {@code otherUserViewAngle}은 상대방 Member의 최신 view_angle 값이다.</p>
 */
public record ChatRoomListItem(
        Long roomId,
        ChatRoomSummaryStatus status,
        UUID pinId,
        String placeName,
        String otherUserNickname,
        BigDecimal otherUserViewAngle,
        String lastMessage,
        Instant lastMessageAt,
        boolean hasUnread
) {
}
