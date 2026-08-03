package com.yuhan.wagglewaggle.domain.recommendation.controller;

import com.yuhan.wagglewaggle.domain.recommendation.dto.RecommendationResponse;
import com.yuhan.wagglewaggle.domain.recommendation.service.RecommendationService;
import com.yuhan.wagglewaggle.global.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 개인화 장소 추천 API.
 * latitude/longitude는 둘 다 전달하거나 둘 다 생략한다(생략 시 최근 GPS 캐시 사용).
 * limit은 유형별 추천 개수(생략 시 5, 1~10).
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/recommendations")
public class RecommendationController {

    private final RecommendationService recommendationService;

    @GetMapping("/places")
    public ApiResponse<RecommendationResponse> getPlaceRecommendations(
            @RequestParam(required = false) Double latitude,
            @RequestParam(required = false) Double longitude,
            @RequestParam(required = false) Integer limit,
            @AuthenticationPrincipal Long memberId
    ) {
        RecommendationResponse data = recommendationService.recommend(memberId, latitude, longitude, limit);
        return ApiResponse.success(HttpStatus.OK.value(), "개인화 장소 추천이 완료되었습니다.", data);
    }
}
