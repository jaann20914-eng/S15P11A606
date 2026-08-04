package com.yuhan.wagglewaggle.domain.recommendation.client.dto;

import java.util.List;

/**
 * AI 추천점수 API 요청 본문(POST /api/v1/internal/recommendations/score).
 * AI(pydantic) 스키마와 필드명이 1:1로 일치해야 한다.
 * requestedAt은 타임존을 포함한 ISO-8601 문자열이어야 한다(AI가 tz 존재를 검증한다).
 * preferredCategories는 1~3개의 CategoryCode 문자열이다.
 */
public record ScoreRequest(
        long userId,
        double latitude,
        double longitude,
        List<String> preferredCategories,
        String gender,
        String ageGroup,
        String requestedAt,
        List<CandidatePlace> candidatePlaces
) {
}
