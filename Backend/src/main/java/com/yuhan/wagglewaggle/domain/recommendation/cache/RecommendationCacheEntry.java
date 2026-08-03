package com.yuhan.wagglewaggle.domain.recommendation.cache;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * 추천 캐시 값. 유형별로 최대 10개의 (placeId, representativePinId) 쌍과 생성 시각을 저장한다.
 * limit은 캐시 키·값에 포함하지 않고 응답 시점에 적용한다.
 * 캐시 적중 시 generatedAt은 저장된 값을 그대로 반환한다.
 */
public record RecommendationCacheEntry(
        List<CachedPlace> relaxed,
        List<CachedPlace> wagle,
        OffsetDateTime generatedAt
) {

    /** 캐시에 저장하는 장소 순서 항목. 응답 조립 시 현재 활성 핀을 다시 조회해 채운다. */
    public record CachedPlace(
            long placeId,
            UUID representativePinId
    ) {
    }
}
