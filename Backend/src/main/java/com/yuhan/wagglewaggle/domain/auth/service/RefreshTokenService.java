package com.yuhan.wagglewaggle.domain.auth.service;

import com.yuhan.wagglewaggle.domain.auth.entity.RefreshToken;
import com.yuhan.wagglewaggle.domain.auth.repository.RefreshTokenRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Optional;

/**
 * 리프레시 토큰 저장·회전·재사용 감지를 담당하는 짧은 DB 트랜잭션.
 * 비즈니스 결과는 예외가 아닌 반환값(RotationOutcome)으로 전달한다.
 * 특히 재사용 감지 시의 폐기 write는 이 트랜잭션에서 커밋되어야 하므로,
 * 예외 던지기는 트랜잭션 밖 오케스트레이터(AuthService)에 위임한다.
 */
@Service
@RequiredArgsConstructor
public class RefreshTokenService {

    private final RefreshTokenRepository refreshTokenRepository;

    /**
     * 로그인/회전 공통 저장. 발급한 토큰의 해시를 활성 상태로 기록한다.
     */
    @Transactional
    public void save(Long memberId, String tokenHash, Instant expiresAt) {
        refreshTokenRepository.save(RefreshToken.create(memberId, tokenHash, expiresAt));
    }

    /**
     * 제출된 토큰(oldHash)을 검증하고 회전한다.
     * - 미존재: NOT_FOUND
     * - 이미 폐기됨(재사용): 회원의 활성 토큰 전체 폐기 후 REUSE_DETECTED
     * - 만료: EXPIRED
     * - 정상: 기존 토큰 폐기 + 새 토큰 저장 후 ROTATED
     */
    @Transactional
    public RotationOutcome rotate(Long memberId, String oldHash, String newHash, Instant newExpiresAt) {
        Instant now = Instant.now();

        Optional<RefreshToken> found = refreshTokenRepository.findByTokenHash(oldHash);
        if (found.isEmpty()) {
            return RotationOutcome.NOT_FOUND;
        }

        RefreshToken current = found.get();
        if (current.isRevoked()) {
            refreshTokenRepository.revokeAllActiveByMemberId(memberId, now);
            return RotationOutcome.REUSE_DETECTED;
        }
        if (current.isExpired(now)) {
            return RotationOutcome.EXPIRED;
        }

        current.revoke(now);
        refreshTokenRepository.save(RefreshToken.create(memberId, newHash, newExpiresAt));
        return RotationOutcome.ROTATED;
    }

    /**
     * 토큰 원문을 SHA-256 hex 문자열로 해시한다. DB에는 원문 대신 이 값만 저장한다.
     */
    public static String hash(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hashed);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 알고리즘을 사용할 수 없습니다.", e);
        }
    }
}
