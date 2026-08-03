package com.yuhan.wagglewaggle.domain.recommendation.controller;

import com.yuhan.wagglewaggle.domain.recommendation.dto.RecommendationResponse;
import com.yuhan.wagglewaggle.domain.recommendation.service.RecommendationService;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import com.yuhan.wagglewaggle.global.response.ApiResponse;
import com.yuhan.wagglewaggle.global.response.ErrorResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

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

    /**
     * latitude/longitude 형식 오류(숫자로 변환 불가)는 스펙상 좌표 형식 오류이므로 INVALID_LOCATION으로 매핑한다.
     * 그 밖의 파라미터(limit 등) 형식 오류는 전역 규약대로 INVALID_REQUEST로 처리한다.
     */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponse> handleTypeMismatch(MethodArgumentTypeMismatchException e) {
        String parameterName = e.getName();
        ErrorCode errorCode = ("latitude".equals(parameterName) || "longitude".equals(parameterName))
                ? ErrorCode.INVALID_LOCATION
                : ErrorCode.INVALID_REQUEST;
        return ResponseEntity.status(errorCode.getStatus()).body(ErrorResponse.of(errorCode));
    }
}
