package com.yuhan.wagglewaggle.domain.place.dto;

/**
 * 장소의 활성 핀 응답 항목.
 */
public record ActivePinResponse(
        Long pinId,
        double latitude,
        double longitude,
        int viewAngle
) {
}
