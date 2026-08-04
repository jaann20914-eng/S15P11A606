package com.yuhan.wagglewaggle.domain.pin.dto;

import com.yuhan.wagglewaggle.domain.pin.entity.CrowdLevel;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * 영상 핀 상세 조회(GET /api/v1/pins/{pinId})의 외부 응답 DTO.
 *
 * <p>보안상 다음 값은 응답에 포함하지 않는다: originalVideoKey, blurredVideoKey, thumbnailKey,
 * 작성자의 내부 memberId, 원본 영상 URL. 블러 영상·썸네일은 요청 시점마다 발급한 Presigned GET URL
 * ({@code videoUrl}·{@code thumbnailUrl})로만 노출한다.</p>
 *
 * <p>{@code createdAt}·{@code expiresAt}은 UTC ISO 8601 형식으로 직렬화한다. 태그가 없으면 빈 배열이다.</p>
 */
public record PinDetailResponse(
        UUID pinId,
        BigDecimal authorViewAngle,
        String authorNickname,
        Instant createdAt,
        Instant expiresAt,
        PlaceDetail place,
        CrowdLevel crowdLevel,
        String detailLocation,
        String memo,
        List<String> tags,
        VideoAccessLevel videoAccess,
        Boolean isEvaluated,
        String videoUrl,
        String thumbnailUrl,
        boolean canRequestChat,
        ChatRequestState chatRequestState
) {

    /**
     * 응답에 포함되는 장소 정보. 위도·경도는 PostGIS Point에서 변환한 값이다(위도=getY, 경도=getX).
     */
    public record PlaceDetail(
            Long placeId,
            String kakaoPlaceId,
            String name,
            double latitude,
            double longitude
    ) {
    }
}
