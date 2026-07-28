package com.yuhan.wagglewaggle.domain.auth.service;

import com.yuhan.wagglewaggle.domain.auth.entity.RefreshToken;
import com.yuhan.wagglewaggle.domain.auth.repository.RefreshTokenRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class RefreshTokenServiceTest {

    @Mock
    private RefreshTokenRepository refreshTokenRepository;

    @InjectMocks
    private RefreshTokenService refreshTokenService;

    private static final Long MEMBER_ID = 99L;
    private static final String OLD_HASH = "old-hash";
    private static final String NEW_HASH = "new-hash";

    @Test
    void save_는_리프레시_토큰을_저장한다() {
        Instant expiresAt = Instant.now().plusSeconds(1209600);

        refreshTokenService.save(MEMBER_ID, OLD_HASH, expiresAt);

        ArgumentCaptor<RefreshToken> captor = ArgumentCaptor.forClass(RefreshToken.class);
        verify(refreshTokenRepository).save(captor.capture());
        assertThat(captor.getValue().getMemberId()).isEqualTo(MEMBER_ID);
        assertThat(captor.getValue().getTokenHash()).isEqualTo(OLD_HASH);
    }

    @Test
    void rotate_존재하지_않는_토큰이면_NOT_FOUND() {
        given(refreshTokenRepository.findByTokenHash(OLD_HASH)).willReturn(Optional.empty());

        RotationOutcome outcome = refreshTokenService.rotate(MEMBER_ID, OLD_HASH, NEW_HASH, futureExpiry());

        assertThat(outcome).isEqualTo(RotationOutcome.NOT_FOUND);
        verify(refreshTokenRepository, never()).save(any());
    }

    @Test
    void rotate_이미_폐기된_토큰이면_재사용감지_및_전체폐기() {
        RefreshToken revoked = RefreshToken.create(MEMBER_ID, OLD_HASH, futureExpiry());
        revoked.revoke(Instant.now());
        given(refreshTokenRepository.findByTokenHash(OLD_HASH)).willReturn(Optional.of(revoked));

        RotationOutcome outcome = refreshTokenService.rotate(MEMBER_ID, OLD_HASH, NEW_HASH, futureExpiry());

        assertThat(outcome).isEqualTo(RotationOutcome.REUSE_DETECTED);
        verify(refreshTokenRepository).revokeAllActiveByMemberId(eq(MEMBER_ID), any(Instant.class));
        verify(refreshTokenRepository, never()).save(any());
    }

    @Test
    void rotate_만료된_토큰이면_EXPIRED() {
        RefreshToken expired = RefreshToken.create(MEMBER_ID, OLD_HASH, Instant.now().minusSeconds(10));
        given(refreshTokenRepository.findByTokenHash(OLD_HASH)).willReturn(Optional.of(expired));

        RotationOutcome outcome = refreshTokenService.rotate(MEMBER_ID, OLD_HASH, NEW_HASH, futureExpiry());

        assertThat(outcome).isEqualTo(RotationOutcome.EXPIRED);
        verify(refreshTokenRepository, never()).save(any());
    }

    @Test
    void rotate_정상이면_기존_토큰_폐기_및_새_토큰_저장() {
        RefreshToken active = RefreshToken.create(MEMBER_ID, OLD_HASH, futureExpiry());
        given(refreshTokenRepository.findByTokenHash(OLD_HASH)).willReturn(Optional.of(active));

        RotationOutcome outcome = refreshTokenService.rotate(MEMBER_ID, OLD_HASH, NEW_HASH, futureExpiry());

        assertThat(outcome).isEqualTo(RotationOutcome.ROTATED);
        assertThat(active.isRevoked()).isTrue();

        ArgumentCaptor<RefreshToken> captor = ArgumentCaptor.forClass(RefreshToken.class);
        verify(refreshTokenRepository).save(captor.capture());
        assertThat(captor.getValue().getTokenHash()).isEqualTo(NEW_HASH);
    }

    @Test
    void hash_는_같은_입력에_같은_해시_다른_입력에_다른_해시() {
        String h1 = RefreshTokenService.hash("token-a");
        String h2 = RefreshTokenService.hash("token-a");
        String h3 = RefreshTokenService.hash("token-b");

        assertThat(h1).isEqualTo(h2);
        assertThat(h1).isNotEqualTo(h3);
        assertThat(h1).hasSize(64); // SHA-256 hex
    }

    private Instant futureExpiry() {
        return Instant.now().plusSeconds(1209600);
    }
}
