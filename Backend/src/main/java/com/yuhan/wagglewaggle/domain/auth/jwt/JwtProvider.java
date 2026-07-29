package com.yuhan.wagglewaggle.domain.auth.jwt;

import com.yuhan.wagglewaggle.domain.auth.entity.OAuthProvider;
import com.yuhan.wagglewaggle.global.properties.JwtProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

/**
 * 서비스 JWT(Access/Refresh/Onboarding) 발급 및 파싱.
 * Access 토큰과 Onboarding 토큰이 같은 서명 키를 사용하므로,
 * 검증 측(JwtAuthenticationFilter 등)은 반드시 purpose 클레임을 확인해야 한다.
 */
@Component
public class JwtProvider {

    public static final String CLAIM_PURPOSE = "purpose";
    public static final String CLAIM_PROVIDER = "provider";
    public static final String CLAIM_SOCIAL_ACCOUNT_ID = "social_account_id";

    private final SecretKey secretKey;
    private final String issuer;
    private final long accessTokenExpirationSeconds;
    private final long refreshTokenExpirationSeconds;
    private final long onboardingTokenExpirationSeconds;

    public JwtProvider(JwtProperties jwtProperties) {
        this.secretKey = Keys.hmacShaKeyFor(jwtProperties.secret().getBytes(StandardCharsets.UTF_8));
        this.issuer = jwtProperties.issuer();
        this.accessTokenExpirationSeconds = jwtProperties.accessTokenExpirationSeconds();
        this.refreshTokenExpirationSeconds = jwtProperties.refreshTokenExpirationSeconds();
        this.onboardingTokenExpirationSeconds = jwtProperties.onboardingTokenExpirationSeconds();
    }

    /**
     * 보호 API 호출용 액세스 토큰. purpose=ACCESS, sub=memberId.
     */
    public String createAccessToken(Long memberId) {
        Instant now = Instant.now();
        return baseBuilder(now)
                .subject(String.valueOf(memberId))
                .claim(CLAIM_PURPOSE, TokenPurpose.ACCESS.name())
                .expiration(Date.from(now.plusSeconds(accessTokenExpirationSeconds)))
                .compact();
    }

    /**
     * 액세스 토큰 재발급용 리프레시 토큰. purpose=REFRESH, sub=memberId.
     */
    public String createRefreshToken(Long memberId) {
        Instant now = Instant.now();
        return baseBuilder(now)
                .subject(String.valueOf(memberId))
                .claim(CLAIM_PURPOSE, TokenPurpose.REFRESH.name())
                .id(UUID.randomUUID().toString())
                .expiration(Date.from(now.plusSeconds(refreshTokenExpirationSeconds)))
                .compact();
    }

    /**
     * 온보딩 완료 요청용 임시 토큰. purpose=ONBOARDING, sub=socialAccountId.
     * social_account_id에는 서비스 DB의 내부 social_account 식별자를 사용한다.
     * Provider 토큰/개인정보는 payload에 포함하지 않는다.
     */
    public String createOnboardingToken(Long socialAccountId, OAuthProvider provider) {
        Instant now = Instant.now();
        return baseBuilder(now)
                .subject(String.valueOf(socialAccountId))
                .claim(CLAIM_SOCIAL_ACCOUNT_ID, socialAccountId)
                .claim(CLAIM_PROVIDER, provider.toLowerCase())
                .claim(CLAIM_PURPOSE, TokenPurpose.ONBOARDING.name())
                .id(UUID.randomUUID().toString())
                .expiration(Date.from(now.plusSeconds(onboardingTokenExpirationSeconds)))
                .compact();
    }

    /**
     * 서명과 만료를 검증하고 Claims를 반환한다. 유효하지 않으면 예외를 던진다.
     */
    public Claims parse(String token) {
        return Jwts.parser()
                .verifyWith(secretKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public TokenPurpose getPurpose(Claims claims) {
        return TokenPurpose.valueOf(claims.get(CLAIM_PURPOSE, String.class));
    }

    public long getAccessTokenExpirationSeconds() {
        return accessTokenExpirationSeconds;
    }

    public long getRefreshTokenExpirationSeconds() {
        return refreshTokenExpirationSeconds;
    }

    private io.jsonwebtoken.JwtBuilder baseBuilder(Instant now) {
        return Jwts.builder()
                .issuer(issuer)
                .issuedAt(Date.from(now))
                .signWith(secretKey);
    }
}
