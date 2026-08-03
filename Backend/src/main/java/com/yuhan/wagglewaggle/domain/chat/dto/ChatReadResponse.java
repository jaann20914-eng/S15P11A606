package com.yuhan.wagglewaggle.domain.chat.dto;

/**
 * 채팅방 읽음 위치 갱신 Response. 갱신 후 현재 사용자의 last_read_message_id를 반환한다.
 */
public record ChatReadResponse(Long roomId, Long lastReadMessageId) {
}
