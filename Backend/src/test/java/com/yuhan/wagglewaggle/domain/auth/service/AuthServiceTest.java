package com.yuhan.wagglewaggle.domain.auth.service;

import com.yuhan.wagglewaggle.domain.auth.client.OAuthClient;
import com.yuhan.wagglewaggle.domain.auth.client.OAuthClientResolver;
import com.yuhan.wagglewaggle.domain.auth.client.OAuthUserInfo;
import com.yuhan.wagglewaggle.domain.auth.dto.AuthStatus;
import com.yuhan.wagglewaggle.domain.auth.dto.OAuthLoginRequest;
import com.yuhan.wagglewaggle.domain.auth.dto.OAuthLoginResponse;
import com.yuhan.wagglewaggle.domain.auth.entity.OAuthProvider;
import com.yuhan.wagglewaggle.domain.auth.jwt.JwtProvider;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private OAuthClientResolver oAuthClientResolver;
    @Mock
    private SocialAccountService socialAccountService;
    @Mock
    private JwtProvider jwtProvider;

    @InjectMocks
    private AuthService authService;

    private static final OAuthLoginRequest VALID_REQUEST = new OAuthLoginRequest("auth-code", "state-value");

    private OAuthClient mockKakaoClient() {
        OAuthClient client = mock(OAuthClient.class);
        given(oAuthClientResolver.resolve(OAuthProvider.KAKAO)).willReturn(client);
        given(client.exchangeToken("auth-code", "state-value")).willReturn("provider-token");
        given(client.getUserInfo("provider-token"))
                .willReturn(new OAuthUserInfo("kakao-123", "user@kakao.com"));
        return client;
    }

    @Test
    void 온보딩_완료_회원이면_AUTHENTICATED() {
        mockKakaoClient();
        given(socialAccountService.findOrCreate(eq(OAuthProvider.KAKAO), any()))
                .willReturn(new SocialAuthResult(10L, 99L));
        given(jwtProvider.createAccessToken(99L)).willReturn("access-jwt");
        given(jwtProvider.createRefreshToken(99L)).willReturn("refresh-jwt");

        OAuthLoginResponse response = authService.login("kakao", VALID_REQUEST);

        assertEquals(AuthStatus.AUTHENTICATED, response.authStatus());
        assertEquals("access-jwt", response.accessToken());
        assertEquals("refresh-jwt", response.refreshToken());
        assertNull(response.onboardingToken());
    }

    @Test
    void 신규_또는_온보딩미완료면_ONBOARDING_REQUIRED() {
        mockKakaoClient();
        given(socialAccountService.findOrCreate(eq(OAuthProvider.KAKAO), any()))
                .willReturn(new SocialAuthResult(10L, null));
        given(jwtProvider.createOnboardingToken(10L, OAuthProvider.KAKAO)).willReturn("onboarding-jwt");

        OAuthLoginResponse response = authService.login("kakao", VALID_REQUEST);

        assertEquals(AuthStatus.ONBOARDING_REQUIRED, response.authStatus());
        assertEquals("onboarding-jwt", response.onboardingToken());
        assertNull(response.accessToken());
        assertNull(response.refreshToken());
    }

    @Test
    void 지원하지_않는_provider면_AUTH_PROVIDER_INVALID() {
        assertThatThrownBy(() -> authService.login("google", VALID_REQUEST))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.AUTH_PROVIDER_INVALID);
    }

    @Test
    void authorizationCode가_비어있으면_INVALID_OAUTH_REQUEST() {
        OAuthLoginRequest request = new OAuthLoginRequest("  ", "state-value");

        assertThatThrownBy(() -> authService.login("kakao", request))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.INVALID_OAUTH_REQUEST);
    }

    @Test
    void state가_비어있으면_INVALID_OAUTH_REQUEST() {
        OAuthLoginRequest request = new OAuthLoginRequest("auth-code", "");

        assertThatThrownBy(() -> authService.login("kakao", request))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.INVALID_OAUTH_REQUEST);
    }

    @Test
    void 클라이언트_토큰교환_실패면_AUTH_OAUTH_FAILED_전파() {
        OAuthClient client = mock(OAuthClient.class);
        given(oAuthClientResolver.resolve(OAuthProvider.NAVER)).willReturn(client);
        given(client.exchangeToken(any(), any()))
                .willThrow(new CustomException(ErrorCode.AUTH_OAUTH_FAILED));

        assertThatThrownBy(() -> authService.login("naver", VALID_REQUEST))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.AUTH_OAUTH_FAILED);
    }
}
