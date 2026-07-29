package com.yuhan.wagglewaggle.domain.onboarding.repository;

import com.yuhan.wagglewaggle.domain.onboarding.entity.OnboardingSession;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface OnboardingSessionRepository extends JpaRepository<OnboardingSession, UUID> {
}
