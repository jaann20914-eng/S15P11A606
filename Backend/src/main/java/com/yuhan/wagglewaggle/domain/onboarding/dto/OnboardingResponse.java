package com.yuhan.wagglewaggle.domain.onboarding.dto;

/**
 * 온보딩 완료 응답. 명세에 정의된 필드만 반환한다(nickname/ageGroup/gender/preferredCategories 미포함).
 */
public record OnboardingResponse(
        Long memberId,
        java.math.BigDecimal viewAngle,
        int creditBalance,
        boolean onboardingCompleted,
        String accessToken,
        String refreshToken
) {
}
