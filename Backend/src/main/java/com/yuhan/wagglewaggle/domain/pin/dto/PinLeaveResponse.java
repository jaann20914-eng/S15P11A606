package com.yuhan.wagglewaggle.domain.pin.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * 핀 제보자 떠남 처리 응답.
 *
 * <p>{@code status}는 처리 결과를 나타내는 API 응답용 값으로 항상 {@code "LEFT"}이며,
 * DB의 {@code pins.publisher_status} 전이 결과와 일치한다.</p>
 *
 * @param pinId           떠남 처리한 핀 ID(Path의 ID와 동일)
 * @param status          처리 결과. 항상 {@code "LEFT"}
 * @param leftChatRoomIds 이번 요청에서 실제로 종료(PENDING·ACTIVE→LEFT)된 채팅방 ID(없으면 빈 배열)
 * @param leftAt          서버 처리 시각(ISO 8601)
 */
public record PinLeaveResponse(
        UUID pinId,
        String status,
        List<Long> leftChatRoomIds,
        Instant leftAt
) {

    private static final String STATUS_LEFT = "LEFT";

    public static PinLeaveResponse of(UUID pinId, List<Long> leftChatRoomIds, Instant leftAt) {
        return new PinLeaveResponse(pinId, STATUS_LEFT, List.copyOf(leftChatRoomIds), leftAt);
    }
}
