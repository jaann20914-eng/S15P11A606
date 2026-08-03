package com.yuhan.wagglewaggle.domain.recommendation.dto;

import java.time.OffsetDateTime;
import java.util.List;

/**
 * 개인화 장소 추천 응답 데이터.
 * relaxed/wagle 두 목록을 항상 모두 반환하며(결과 없으면 빈 배열), 토글 변경 시 재호출하지 않는다.
 * generatedAt은 캐시 적중 시 저장된 생성 시각을 그대로 반환한다(Front의 'N분 전 업데이트' 표시용).
 */
public record RecommendationResponse(
        LocationSource locationSource,
        OffsetDateTime generatedAt,
        Recommendations recommendations
) {

    public record Recommendations(
            List<PlaceCard> relaxed,
            List<PlaceCard> wagle
    ) {
    }
}
