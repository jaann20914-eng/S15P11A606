package com.yuhan.wagglewaggle.domain.auth.service;

import com.yuhan.wagglewaggle.domain.auth.client.OAuthClient;
import com.yuhan.wagglewaggle.domain.auth.client.OAuthClientResolver;
import com.yuhan.wagglewaggle.domain.auth.client.OAuthUserInfo;
import com.yuhan.wagglewaggle.domain.auth.dto.OAuthLoginRequest;
import com.yuhan.wagglewaggle.domain.auth.dto.OAuthLoginResponse;
import com.yuhan.wagglewaggle.domain.auth.dto.TokenRefreshRequest;
import com.yuhan.wagglewaggle.domain.auth.dto.TokenRefreshResponse;
import com.yuhan.wagglewaggle.domain.auth.entity.OAuthProvider;
import com.yuhan.wagglewaggle.domain.auth.jwt.JwtProvider;
import com.yuhan.wagglewaggle.domain.auth.jwt.TokenPurpose;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Instant;

/**
 * OAuth 로그인 오케스트레이션.
 * Provider 외부 HTTP 통신은 트랜잭션 밖에서 수행하고,
 * 소셜 계정 저장/상태 처리는 SocialAccountService의 짧은 트랜잭션에 위임한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final OAuthClientResolver oAuthClientResolver;
    private final SocialAccountService socialAccountService;
    private final RefreshTokenService refreshTokenService;
    private final JwtProvider jwtProvider;

    public OAuthLoginResponse login(String providerPath, OAuthLoginRequest request) {
        OAuthProvider provider = OAuthProvider.from(providerPath);
        validateRequest(request);

        OAuthClient client = oAuthClientResolver.resolve(provider);

        // 외부 통신 (트랜잭션 밖)
        String providerAccessToken = client.exchangeToken(request.authorizationCode(), request.state());
        OAuthUserInfo userInfo = client.getUserInfo(providerAccessToken);

        // 소셜 계정 저장/상태 처리 (짧은 트랜잭션)
        SocialAuthResult result;
        try {
            result = socialAccountService.findOrCreate(provider, userInfo);
        } catch (Exception e) {
            log.error("소셜 계정 처리 실패: {}", e.getMessage());
            throw new CustomException(ErrorCode.AUTH_PROCESS_FAILED);
        }

        return issueTokens(provider, result);
    }

    private void validateRequest(OAuthLoginRequest request) {
        if (request == null
                || !StringUtils.hasText(request.authorizationCode())
                || !StringUtils.hasText(request.state())) {
            throw new CustomException(ErrorCode.INVALID_OAUTH_REQUEST);
        }
    }

    private OAuthLoginResponse issueTokens(OAuthProvider provider, SocialAuthResult result) {
        try {
            if (result.isOnboardingCompleted()) {
                String accessToken = jwtProvider.createAccessToken(result.memberId());
                String refreshToken = jwtProvider.createRefreshToken(result.memberId());
                // 재발급 시 서버 저장 정보와 대조하기 위해 로그인 시점에도 리프레시 토큰을 저장한다.
                refreshTokenService.save(
                        result.memberId(),
                        RefreshTokenService.hash(refreshToken),
                        Instant.now().plusSeconds(jwtProvider.getRefreshTokenExpirationSeconds()));
                return OAuthLoginResponse.authenticated(accessToken, refreshToken);
            }
            String onboardingToken = jwtProvider.createOnboardingToken(result.socialAccountId(), provider);
            return OAuthLoginResponse.onboardingRequired(onboardingToken);
        } catch (Exception e) {
            log.error("토큰 발급 실패: {}", e.getMessage());
            throw new CustomException(ErrorCode.AUTH_PROCESS_FAILED);
        }
    }

    /**
     * 리프레시 토큰 재발급(RTR). 트랜잭션 밖 오케스트레이션이며, DB 회전/폐기는
     * RefreshTokenService의 짧은 트랜잭션에 위임한다. 재사용 감지 시의 폐기는
     * 그 트랜잭션에서 커밋된 뒤, 여기서 401 예외를 던진다.
     */
    public TokenRefreshResponse refresh(TokenRefreshRequest request) {
        if (request == null || !StringUtils.hasText(request.refreshToken())) {
            throw new CustomException(ErrorCode.REFRESH_TOKEN_REQUIRED);
        }
        String presentedToken = request.refreshToken();

        // 서명/만료/형식 및 purpose 검증
        Long memberId = parseRefreshTokenMemberId(presentedToken);

        try {
            String newAccessToken = jwtProvider.createAccessToken(memberId);
            String newRefreshToken = jwtProvider.createRefreshToken(memberId);
            Instant newExpiresAt = Instant.now().plusSeconds(jwtProvider.getRefreshTokenExpirationSeconds());

            RotationOutcome outcome = refreshTokenService.rotate(
                    memberId,
                    RefreshTokenService.hash(presentedToken),
                    RefreshTokenService.hash(newRefreshToken),
                    newExpiresAt);

            switch (outcome) {
                case ROTATED -> {
                    return new TokenRefreshResponse(
                            newAccessToken,
                            jwtProvider.getAccessTokenExpirationSeconds(),
                            newRefreshToken,
                            jwtProvider.getRefreshTokenExpirationSeconds());
                }
                case REUSE_DETECTED -> throw new CustomException(ErrorCode.REFRESH_TOKEN_REUSED);
                case NOT_FOUND, EXPIRED -> throw new CustomException(ErrorCode.INVALID_REFRESH_TOKEN);
                default -> throw new CustomException(ErrorCode.TOKEN_REFRESH_FAILED);
            }
        } catch (CustomException e) {
            throw e;
        } catch (Exception e) {
            log.error("토큰 재발급 실패: {}", e.getMessage());
            throw new CustomException(ErrorCode.TOKEN_REFRESH_FAILED);
        }
    }

    private Long parseRefreshTokenMemberId(String token) {
        try {
            Claims claims = jwtProvider.parse(token);
            if (jwtProvider.getPurpose(claims) != TokenPurpose.REFRESH) {
                throw new CustomException(ErrorCode.INVALID_REFRESH_TOKEN);
            }
            return Long.valueOf(claims.getSubject());
        } catch (CustomException e) {
            throw e;
        } catch (Exception e) {
            throw new CustomException(ErrorCode.INVALID_REFRESH_TOKEN);
        }
    }
}
