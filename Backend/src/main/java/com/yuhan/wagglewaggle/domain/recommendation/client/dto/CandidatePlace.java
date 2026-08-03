package com.yuhan.wagglewaggle.domain.recommendation.client.dto;

import java.util.Map;
import java.util.UUID;

/**
 * AI 추천점수 API 요청의 후보 장소 항목. AI(pydantic) 스키마와 필드명이 1:1로 일치해야 한다.
 * - category: CategoryCode 문자열(6종). ETC 장소는 후보에서 제외되므로 여기에 오지 않는다.
 * - crowdLevel: 활성 핀 혼잡도(1~4) 평균값이라 소수점이 올 수 있다.
 * - lastPinActivatedAt: 타임존 포함 ISO-8601 문자열(활성 핀 중 가장 최근 활성화 시각).
 * - authorGenderDist/authorAgeDist: 작성자 분포(비율 합=1). 비율 0인 항목은 생략될 수 있다.
 */
public record CandidatePlace(
        long placeId,
        UUID representativePinId,
        double latitude,
        double longitude,
        String category,
        double crowdLevel,
        String lastPinActivatedAt,
        int unlockCount7d,
        int authorCount,
        Map<String, Double> authorGenderDist,
        Map<String, Double> authorAgeDist
) {
}
