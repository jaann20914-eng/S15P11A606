package com.yuhan.wagglewaggle.domain.chat.dto;

/**
 * 채팅방 읽음 위치 갱신 Request. 현재 사용자가 화면에서 마지막으로 확인한 메시지 id를 담는다.
 */
public record ChatReadRequest(Long lastReadMessageId) {
}
