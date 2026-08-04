package com.yuhan.wagglewaggle.domain.recommendation.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

/**
 * AI 추천점수 API 응답 본문.
 * relaxedList/wagleList는 각각 score 내림차순으로 정렬된 장소 목록이며,
 * AI가 crowdLevel 기준 2.5로 분류하고 각 목록을 최대 10개까지 반환한다.
 * lastUpdated는 타임존 포함 ISO-8601 문자열이다.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record ScoreResponse(
        List<ScoredPlace> relaxedList,
        List<ScoredPlace> wagleList,
        String lastUpdated
) {
}
