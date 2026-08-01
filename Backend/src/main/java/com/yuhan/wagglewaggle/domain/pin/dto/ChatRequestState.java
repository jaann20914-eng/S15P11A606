package com.yuhan.wagglewaggle.domain.pin.dto;

/**
 * 현재 사용자와 해당 핀 사이의 채팅 요청/채팅방 상태(핀 상세 응답 계약).
 *
 * <p>현재 프로젝트에는 별도의 "채팅 요청" 테이블이 없고 {@link com.yuhan.wagglewaggle.domain.chat.entity.ChatRoom}만
 * 존재하며, 실제 방 상태는 {@link com.yuhan.wagglewaggle.domain.chat.entity.ChatRoomStatus}
 * = {ACTIVE, REFUSED, LEFT} 이다. {@code chat_rooms}의 (pin_id, requester_id) 유니크 제약으로
 * (핀, 요청자)당 채팅방은 최대 1건이므로 다중 기록 우선순위 문제는 발생하지 않는다.</p>
 *
 * <p>매핑: 채팅방 없음 → {@code NONE}, ACTIVE → {@code ACTIVE}, REFUSED·LEFT → {@code CLOSED}.
 * {@code PENDING}은 응답 계약에는 포함하지만, 현재 데이터 모델에는 이에 대응하는 상태가 없어
 * 실제로는 도달하지 않는다(추후 채팅 요청 승인 흐름 도입 시 사용).</p>
 */
public enum ChatRequestState {
    NONE,
    PENDING,
    ACTIVE,
    CLOSED
}
