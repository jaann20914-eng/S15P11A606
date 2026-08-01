package com.yuhan.wagglewaggle.domain.pin.dto;

import com.yuhan.wagglewaggle.domain.pin.entity.VideoStatus;

import java.time.Instant;
import java.util.UUID;

/**
 * 핀 영상 처리 상태 조회의 <b>내부 처리용</b> 결과 모델.
 *
 * <p>상태별 응답 메시지와, ACTIVE일 때만 존재하는 Object Storage Key(blurredVideoKey·thumbnailKey)와
 * 만료 시각(expiresAt)을 담는다. Key와 만료 시각은 다음 단계(Presigned GET URL 발급·만료 판정)에서
 * 사용하기 위한 내부 값이며, 절대 API 응답 DTO로 직접 노출해서는 안 된다.
 * Controller 응답 DTO는 이 결과를 videoUrl·thumbnailUrl로 변환한 뒤 별도 구조로 분리해 반환한다.</p>
 *
 * <p>PENDING·REJECTED·FAILED 상태에서는 Key와 만료 시각이 모두 null이며, 이때 응답의
 * videoUrl·thumbnailUrl도 null이 된다.</p>
 */
public record PinVideoStatusResult(
        UUID pinId,
        VideoStatus videoStatus,
        String message,
        String blurredVideoKey,
        String thumbnailKey,
        Instant expiresAt
) {

    private static final String PENDING_MESSAGE = "영상 처리 상태를 조회했습니다.";
    private static final String ACTIVE_MESSAGE = "영상 처리가 완료되었습니다.";
    private static final String REJECTED_MESSAGE = "영상이 검수 기준을 통과하지 못했습니다.";
    private static final String FAILED_MESSAGE = "영상 처리 중 오류가 발생했습니다.";

    /** PENDING: 아직 AI 블러 처리 대기 중이라 영상·썸네일 Key가 없다. */
    public static PinVideoStatusResult pending(UUID pinId) {
        return new PinVideoStatusResult(pinId, VideoStatus.PENDING, PENDING_MESSAGE, null, null, null);
    }

    /** ACTIVE: 블러 영상·썸네일 Key와 만료 시각을 내부 처리용으로 전달한다(응답에는 URL로만 노출). */
    public static PinVideoStatusResult active(UUID pinId, String blurredVideoKey, String thumbnailKey, Instant expiresAt) {
        return new PinVideoStatusResult(pinId, VideoStatus.ACTIVE, ACTIVE_MESSAGE, blurredVideoKey, thumbnailKey, expiresAt);
    }

    /** REJECTED: 검수 기준을 통과하지 못해 공개하지 않는다. 영상·썸네일 Key가 없다. */
    public static PinVideoStatusResult rejected(UUID pinId) {
        return new PinVideoStatusResult(pinId, VideoStatus.REJECTED, REJECTED_MESSAGE, null, null, null);
    }

    /** FAILED: 처리 중 오류로 공개하지 않는다. 영상·썸네일 Key가 없다. */
    public static PinVideoStatusResult failed(UUID pinId) {
        return new PinVideoStatusResult(pinId, VideoStatus.FAILED, FAILED_MESSAGE, null, null, null);
    }
}
