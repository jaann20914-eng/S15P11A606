package com.yuhan.wagglewaggle.domain.onboarding.service;

import com.yuhan.wagglewaggle.domain.onboarding.entity.OnboardingSession;
import com.yuhan.wagglewaggle.domain.onboarding.repository.OnboardingSessionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/**
 * 온보딩 세션 저장을 담당하는 짧은 DB 트랜잭션.
 * OAuth 로그인에서 온보딩 토큰을 발급할 때 토큰의 jti와 동일한 세션을 생성한다.
 */
@Service
@RequiredArgsConstructor
public class OnboardingSessionService {

    private final OnboardingSessionRepository onboardingSessionRepository;

    @Transactional
    public void issue(UUID jti, Long socialAccountId, Instant expiresAt) {
        onboardingSessionRepository.save(OnboardingSession.create(jti, socialAccountId, expiresAt));
    }
}
