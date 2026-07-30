package com.yuhan.wagglewaggle.domain.onboarding.repository;

import com.yuhan.wagglewaggle.domain.onboarding.entity.OnboardingSession;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface OnboardingSessionRepository extends JpaRepository<OnboardingSession, UUID> {

    /**
     * 동일 jti의 동시 온보딩을 막기 위해 세션 행을 잠근 채 조회한다.
     * 두 번째 요청은 첫 요청이 커밋될 때까지 대기 후 used_at이 채워진 상태를 보게 된다.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from OnboardingSession s where s.jti = :jti")
    Optional<OnboardingSession> findByJtiForUpdate(@Param("jti") UUID jti);
}
