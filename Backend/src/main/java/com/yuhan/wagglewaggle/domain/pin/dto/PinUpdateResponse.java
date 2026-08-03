package com.yuhan.wagglewaggle.domain.pin.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJobStatus;
import com.yuhan.wagglewaggle.domain.pin.entity.VideoStatus;

import java.util.List;
import java.util.UUID;

/**
 * 핀 수정 응답.
 *
 * <ul>
 *   <li>일반 정보만 수정(200): {@code pinId}, {@code videoStatus}, {@code updatedFields}만 채운다.</li>
 *   <li>영상 교체 포함(202): 위에 더해 {@code videoReplacementStatus=PENDING}, {@code pendingFields}를 채운다.</li>
 * </ul>
 *
 * {@code updatedFields}는 요청에 포함된 필드가 아니라 실제 DB 값이 바뀐 필드만 담는다(영상만 교체하면 빈 배열).
 * 일반 정보만 수정한 경우 {@code videoReplacementStatus}·{@code pendingFields}는 null이며 응답에서 생략된다.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record PinUpdateResponse(
        UUID pinId,
        VideoStatus videoStatus,
        List<String> updatedFields,
        AiBlurJobStatus videoReplacementStatus,
        List<String> pendingFields
) {

    /** 일반 정보만 수정된 응답(200). */
    public static PinUpdateResponse generalOnly(UUID pinId, VideoStatus videoStatus, List<String> updatedFields) {
        return new PinUpdateResponse(pinId, videoStatus, updatedFields, null, null);
    }

    /** 영상 교체가 접수된 응답(202). videoReplacementStatus는 항상 PENDING이다. */
    public static PinUpdateResponse withReplacement(
            UUID pinId, VideoStatus videoStatus, List<String> updatedFields, List<String> pendingFields) {
        return new PinUpdateResponse(
                pinId, videoStatus, updatedFields, AiBlurJobStatus.PENDING, pendingFields);
    }

    /** 영상 교체 접수 여부(응답 상태코드 200/202 분기용). */
    public boolean isVideoReplacementAccepted() {
        return videoReplacementStatus != null;
    }
}
