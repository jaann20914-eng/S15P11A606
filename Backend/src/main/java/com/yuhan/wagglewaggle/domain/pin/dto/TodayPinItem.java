package com.yuhan.wagglewaggle.domain.pin.dto;

import java.time.Instant;
import java.util.UUID;

/**
 * 오늘 등록 핀 목록의 단일 항목.
 *
 * <p>장소명·주소는 외부 장소 API를 호출하지 않고 DB에 저장된 places 값을 그대로 반환한다.
 * status는 내부 영상 상태를 외부 표현으로 변환한 {@link TodayPinStatus}이며,
 * createdAt은 UTC 기반 ISO-8601(Instant)로 전달하고 timezone 변환은 클라이언트에서 처리한다.</p>
 */
public record TodayPinItem(
        UUID pinId,
        Long placeId,
        String placeName,
        String placeAddress,
        TodayPinStatus status,
        Instant createdAt
) {
}
