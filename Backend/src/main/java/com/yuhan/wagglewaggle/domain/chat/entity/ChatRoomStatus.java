package com.yuhan.wagglewaggle.domain.chat.entity;

/**
 * 채팅방 상태. DB의 chat_room_status_type에 대응한다.
 * PENDING(요청 대기) → ACTIVE(수락) | REFUSED(거절), 이후 LEFT(나감).
 */
public enum ChatRoomStatus {
    PENDING,
    ACTIVE,
    REFUSED,
    LEFT
}
