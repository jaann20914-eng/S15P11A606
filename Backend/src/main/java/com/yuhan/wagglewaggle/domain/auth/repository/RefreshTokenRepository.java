package com.yuhan.wagglewaggle.domain.auth.repository;

import com.yuhan.wagglewaggle.domain.auth.entity.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {

    Optional<RefreshToken> findByTokenHash(String tokenHash);

    /**
     * 재사용 감지 시 해당 회원의 아직 폐기되지 않은 모든 토큰을 한 번에 폐기한다.
     */
    @Modifying(clearAutomatically = true)
    @Query("update RefreshToken rt set rt.revokedAt = :now "
            + "where rt.memberId = :memberId and rt.revokedAt is null")
    int revokeAllActiveByMemberId(@Param("memberId") Long memberId, @Param("now") Instant now);
}
