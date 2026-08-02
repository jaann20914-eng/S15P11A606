package com.yuhan.wagglewaggle.domain.place.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * 장소 홈의 활성 영상 핀 카드.
 */
public record PinCard(
        UUID pinId,
        String nickname,
        BigDecimal viewAngle,
        Instant createdAt,
        String memo,
        String thumbnailKey,
        boolean isUnlocked, //현재 인증 사용자가 해당 핀 영상을 열람(unlock)했는지 여부
        List<String> tags
) {
}
