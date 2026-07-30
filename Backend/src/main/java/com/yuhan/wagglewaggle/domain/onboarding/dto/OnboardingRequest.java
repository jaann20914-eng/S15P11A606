package com.yuhan.wagglewaggle.domain.onboarding.dto;

import java.util.List;

/**
 * 온보딩 완료 요청. ageGroup/gender는 문자열로 받아 서비스에서 enum으로 파싱한다
 * (잘못된 enum도 INVALID_ONBOARDING_REQUEST로 통일하기 위함).
 * 소셜 계정 식별값은 Body로 받지 않고 온보딩 토큰에서 읽는다.
 */
public record OnboardingRequest(
        String ageGroup,
        String gender,
        String nickname,
        List<String> preferredCategories
) {
}
