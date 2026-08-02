package com.yuhan.wagglewaggle.domain.place.dto;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * 장소의 활성 핀 응답 항목.
 */
public record ActivePinResponse(
        UUID pinId,
        double latitude,
        double longitude,
        BigDecimal viewAngle
) {
}
