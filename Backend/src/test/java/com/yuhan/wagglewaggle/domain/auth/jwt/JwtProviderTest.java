package com.yuhan.wagglewaggle.domain.auth.jwt;

import com.yuhan.wagglewaggle.domain.auth.entity.OAuthProvider;
import com.yuhan.wagglewaggle.global.properties.JwtProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

class JwtProviderTest {

    private static final String SECRET = "test-secret-key-that-is-at-least-32-bytes-long!!";
    private static final String ISSUER = "wagglewaggle-test";

    private JwtProvider jwtProvider(long onboardingExpSeconds) {
        JwtProperties properties = new JwtProperties(SECRET, ISSUER, 3600, 1209600, onboardingExpSeconds);
        return new JwtProvider(properties);
    }

    @Test
    void createAccessToken_라운드트립() {
        JwtProvider provider = jwtProvider(600);

        String token = provider.createAccessToken(123L);
        Claims claims = provider.parse(token);

        assertEquals("123", claims.getSubject());
        assertEquals(ISSUER, claims.getIssuer());
        assertEquals(TokenPurpose.ACCESS, provider.getPurpose(claims));
    }

    @Test
    void createRefreshToken_purpose_검증() {
        JwtProvider provider = jwtProvider(600);

        String token = provider.createRefreshToken(456L);
        Claims claims = provider.parse(token);

        assertEquals("456", claims.getSubject());
        assertEquals(TokenPurpose.REFRESH, provider.getPurpose(claims));
        assertNotNull(claims.getId()); // jti
    }

    @Test
    void createRefreshToken_은_매번_고유한_jti로_서로_다른_토큰을_만든다() {
        JwtProvider provider = jwtProvider(600);

        String token1 = provider.createRefreshToken(456L);
        String token2 = provider.createRefreshToken(456L);

        assertNotEquals(token1, token2);
        assertNotEquals(provider.parse(token1).getId(), provider.parse(token2).getId());
    }

    @Test
    void createOnboardingToken_클레임_검증() {
        JwtProvider provider = jwtProvider(600);

        String token = provider.createOnboardingToken(789L, OAuthProvider.KAKAO);
        Claims claims = provider.parse(token);

        assertEquals("789", claims.getSubject());
        assertEquals(789L, claims.get(JwtProvider.CLAIM_SOCIAL_ACCOUNT_ID, Long.class));
        assertEquals("kakao", claims.get(JwtProvider.CLAIM_PROVIDER, String.class));
        assertEquals(TokenPurpose.ONBOARDING, provider.getPurpose(claims));
        assertNotNull(claims.getId()); // jti
    }

    @Test
    void 만료된_토큰_파싱시_예외() {
        JwtProvider provider = jwtProvider(-1); // 이미 만료된 온보딩 토큰

        String token = provider.createOnboardingToken(1L, OAuthProvider.NAVER);

        assertThrows(ExpiredJwtException.class, () -> provider.parse(token));
    }
}
