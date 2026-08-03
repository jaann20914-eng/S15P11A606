package com.yuhan.wagglewaggle.domain.pin.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * 영상 핀 삭제 응답.
 *
 * <p>{@code status}는 삭제 처리 결과를 나타내는 API 응답용 값으로 항상 {@code "DELETED"}이며,
 * DB의 {@code pins.video_status} 값이 아니다(삭제 시 video_status는 변경하지 않는다).</p>
 *
 * @param pinId             삭제한 핀 ID(Path의 ID와 동일)
 * @param status            삭제 처리 결과. 항상 {@code "DELETED"}
 * @param closedChatRoomIds 이번 요청에서 실제로 종료(ACTIVE→LEFT)된 채팅방 ID(없으면 빈 배열)
 * @param deletedAt         삭제 처리 시각(최초 삭제 시각, ISO 8601)
 */
public record PinDeleteResponse(
        UUID pinId,
        String status,
        List<Long> closedChatRoomIds,
        Instant deletedAt
) {

    private static final String STATUS_DELETED = "DELETED";

    public static PinDeleteResponse of(UUID pinId, List<Long> closedChatRoomIds, Instant deletedAt) {
        return new PinDeleteResponse(pinId, STATUS_DELETED, List.copyOf(closedChatRoomIds), deletedAt);
    }
}
