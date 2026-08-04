package com.yuhan.wagglewaggle.domain.chat.dto;

import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoomStatus;

/**
 * 채팅방 목록 응답용 상태(계약).
 *
 * <p>내부 {@link ChatRoomStatus}(PENDING·ACTIVE·REFUSED·LEFT)를 프론트 계약(PENDING·ACTIVE·CLOSED)으로
 * 매핑한다. 거절(REFUSED)·종료(LEFT)된 방은 모두 이력 조회만 가능한 {@code CLOSED}로 노출한다.
 * (핀 상세의 {@code ChatRequestState}와 동일한 매핑 규칙)</p>
 */
public enum ChatRoomSummaryStatus {
    PENDING,
    ACTIVE,
    CLOSED;

    public static ChatRoomSummaryStatus from(ChatRoomStatus status) {
        return switch (status) {
            case PENDING -> PENDING;
            case ACTIVE -> ACTIVE;
            case REFUSED, LEFT -> CLOSED;
        };
    }
}
