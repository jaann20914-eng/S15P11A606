package com.yuhan.wagglewaggle.domain.auth.service;

/**
 * 소셜 계정 조회·생성 결과. LazyInitialization을 피하기 위해
 * 트랜잭션 안에서 필요한 식별자만 추출해 반환한다.
 * memberId가 null이면 온보딩 미완료(신규 포함) 상태다.
 */
public record SocialAuthResult(
        Long socialAccountId,
        Long memberId
) {
    public boolean isOnboardingCompleted() {
        return memberId != null;
    }
}
