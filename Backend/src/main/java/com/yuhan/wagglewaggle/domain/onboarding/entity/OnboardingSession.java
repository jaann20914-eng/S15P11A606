package com.yuhan.wagglewaggle.domain.onboarding.entity;

import com.yuhan.wagglewaggle.global.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

/**
 * 온보딩 세션. OAuth 로그인 시 온보딩 토큰을 발급할 때 생성되고, 온보딩 완료 시 used_at으로 소비된다.
 * PK는 온보딩 토큰의 jti(UUID)다. jti 조회 후 social_account_id로 내부 소셜 계정을 판별한다.
 */
@Getter
@Entity
@Table(name = "onboarding_sessions")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class OnboardingSession extends BaseEntity {

    @Id
    @Column(name = "jti")
    private UUID jti;

    @Column(name = "social_account_id", nullable = false)
    private Long socialAccountId;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Column(name = "used_at")
    private Instant usedAt;

    private OnboardingSession(UUID jti, Long socialAccountId, Instant expiresAt) {
        this.jti = jti;
        this.socialAccountId = socialAccountId;
        this.expiresAt = expiresAt;
    }

    public static OnboardingSession create(UUID jti, Long socialAccountId, Instant expiresAt) {
        return new OnboardingSession(jti, socialAccountId, expiresAt);
    }

    public boolean isUsed() {
        return usedAt != null;
    }

    public boolean isExpired(Instant now) {
        return expiresAt.isBefore(now);
    }
}
