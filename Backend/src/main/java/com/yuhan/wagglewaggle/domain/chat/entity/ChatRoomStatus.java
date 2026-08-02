package com.yuhan.wagglewaggle.domain.chat.entity;

/**
 * 채팅방 상태. DB의 chat_room_status_type에 대응한다.
 *
 * <p>{@code LEFT}는 종료된 방을 나타낸다. 핀 삭제 등으로 대화가 종료되면 ACTIVE 방을 LEFT로 전환하며,
 * 종료된 방은 기존 정보·메시지 조회만 허용하고 새 메시지는 차단한다.</p>
 * PENDING(요청 대기) → ACTIVE(수락) | REFUSED(거절), 이후 LEFT(나감).
 */
public enum ChatRoomStatus {
    PENDING,
    ACTIVE,
    REFUSED,
    LEFT
}
