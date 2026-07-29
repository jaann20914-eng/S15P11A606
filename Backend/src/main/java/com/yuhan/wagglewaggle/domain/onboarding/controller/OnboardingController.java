package com.yuhan.wagglewaggle.domain.onboarding.controller;

import com.yuhan.wagglewaggle.domain.onboarding.dto.OnboardingRequest;
import com.yuhan.wagglewaggle.domain.onboarding.dto.OnboardingResponse;
import com.yuhan.wagglewaggle.domain.onboarding.service.OnboardingService;
import com.yuhan.wagglewaggle.global.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/onboarding")
public class OnboardingController {

    private final OnboardingService onboardingService;

    /**
     * 신규 사용자 온보딩 완료. 일반 Access Token이 아닌 Onboarding Token 전용 인증을 사용한다.
     * 토큰/입력 검증은 서비스에서 수행하므로 헤더·바디를 선택 파라미터로 받아 정확한 오류 코드를 반환한다.
     */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<OnboardingResponse> complete(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization,
            @RequestBody(required = false) OnboardingRequest request
    ) {
        OnboardingResponse data = onboardingService.complete(authorization, request);
        return ApiResponse.success(HttpStatus.CREATED.value(), "온보딩이 완료되었습니다.", data);
    }
}
