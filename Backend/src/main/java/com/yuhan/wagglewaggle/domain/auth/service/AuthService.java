package com.yuhan.wagglewaggle.domain.auth.service;

import com.yuhan.wagglewaggle.domain.auth.client.OAuthClient;
import com.yuhan.wagglewaggle.domain.auth.client.OAuthClientResolver;
import com.yuhan.wagglewaggle.domain.auth.client.OAuthUserInfo;
import com.yuhan.wagglewaggle.domain.auth.dto.OAuthLoginRequest;
import com.yuhan.wagglewaggle.domain.auth.dto.OAuthLoginResponse;
import com.yuhan.wagglewaggle.domain.auth.entity.OAuthProvider;
import com.yuhan.wagglewaggle.domain.auth.jwt.JwtProvider;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

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
                return OAuthLoginResponse.authenticated(accessToken, refreshToken);
            }
            String onboardingToken = jwtProvider.createOnboardingToken(result.socialAccountId(), provider);
            return OAuthLoginResponse.onboardingRequired(onboardingToken);
        } catch (Exception e) {
            log.error("토큰 발급 실패: {}", e.getMessage());
            throw new CustomException(ErrorCode.AUTH_PROCESS_FAILED);
        }
    }
}
