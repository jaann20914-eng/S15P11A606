package com.yuhan.wagglewaggle.domain.chat.entity;

/**
 * 채팅방 상태. DB의 chat_room_status_type에 대응한다.
 */
public enum ChatRoomStatus {
    ACTIVE,
    REFUSED,
    LEFT
}
