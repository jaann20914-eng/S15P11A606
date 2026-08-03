package com.yuhan.wagglewaggle.domain.pin.dto;

import com.yuhan.wagglewaggle.domain.pin.entity.CrowdLevel;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * 영상 핀 상세 조회의 내부 결과 모델.
 *
 * <p>조회 가능한(ACTIVE·미삭제·미만료) 핀의 기본 데이터만 담는다. 외부 응답 DTO가 아니라
 * 서비스 계층 내부 전달용이므로, 이후 내부 URL 생성에만 쓰이는 {@code blurredVideoKey}·
 * {@code thumbnailKey}를 함께 보관한다. 이 두 키는 외부 응답 모델에는 노출하지 않는다.</p>
 *
 * <p>위도·경도는 Place의 PostGIS geography(Point,4326)를 좌표로 변환한 값이다
 * (기존 방식과 동일하게 위도=Point.getY(), 경도=Point.getX()).</p>
 */
public record PinDetail(
        UUID pinId,
        BigDecimal authorViewAngle,
        String authorNickname,
        Instant createdAt,
        Long placeId,
        String kakaoPlaceId,
        String placeName,
        double latitude,
        double longitude,
        CrowdLevel crowdLevel,
        String detailLocation,
        String memo,
        List<String> tags,
        String blurredVideoKey,
        String thumbnailKey,
        Instant expiresAt
) {
}
