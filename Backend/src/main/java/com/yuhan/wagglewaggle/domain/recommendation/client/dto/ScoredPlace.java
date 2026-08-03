package com.yuhan.wagglewaggle.domain.recommendation.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.UUID;

/**
 * AI 추천점수 API 응답의 장소별 점수 항목.
 * score는 정렬(내림차순)에 이미 반영되어 있으며 Front 응답에는 노출하지 않는다.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ScoredPlace(
        long placeId,
        UUID representativePinId,
        double score
) {
}
