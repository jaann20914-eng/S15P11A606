package com.yuhan.wagglewaggle.domain.pin.dto;

import com.yuhan.wagglewaggle.domain.pin.entity.VideoStatus;

import java.util.UUID;

/**
 * 핀 영상 처리 상태 조회 API 응답 데이터.
 *
 * <p>Object Storage Key(originalVideoKey·blurredVideoKey·thumbnailKey)는 절대 노출하지 않는다.
 * videoUrl·thumbnailUrl은 ACTIVE이면서 만료되지 않은 경우에만 발급되는 Presigned GET URL이며,
 * 그 외 상태에서는 항상 함께 null이다(부분 URL을 허용하지 않는다).</p>
 */
public record PinVideoStatusResponse(
        UUID pinId,
        VideoStatus videoStatus,
        String videoUrl,
        String thumbnailUrl
) {

    /** URL을 발급하지 않는 상태(PENDING·REJECTED·FAILED, 만료된 ACTIVE)의 응답. */
    public static PinVideoStatusResponse withoutUrls(UUID pinId, VideoStatus videoStatus) {
        return new PinVideoStatusResponse(pinId, videoStatus, null, null);
    }

    /** ACTIVE이며 만료되지 않아 영상·썸네일 URL을 함께 발급하는 응답. */
    public static PinVideoStatusResponse withUrls(UUID pinId, String videoUrl, String thumbnailUrl) {
        return new PinVideoStatusResponse(pinId, VideoStatus.ACTIVE, videoUrl, thumbnailUrl);
    }
}
