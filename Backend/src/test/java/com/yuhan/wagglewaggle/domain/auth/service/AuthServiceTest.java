package com.yuhan.wagglewaggle.domain.auth.service;

import com.yuhan.wagglewaggle.domain.auth.client.OAuthClient;
import com.yuhan.wagglewaggle.domain.auth.client.OAuthClientResolver;
import com.yuhan.wagglewaggle.domain.auth.client.OAuthUserInfo;
import com.yuhan.wagglewaggle.domain.auth.dto.AuthStatus;
import com.yuhan.wagglewaggle.domain.auth.dto.OAuthLoginRequest;
import com.yuhan.wagglewaggle.domain.auth.dto.OAuthLoginResponse;
import com.yuhan.wagglewaggle.domain.auth.dto.TokenRefreshRequest;
import com.yuhan.wagglewaggle.domain.auth.dto.TokenRefreshResponse;
import com.yuhan.wagglewaggle.domain.auth.entity.OAuthProvider;
import com.yuhan.wagglewaggle.domain.auth.jwt.JwtProvider;
import com.yuhan.wagglewaggle.domain.auth.jwt.TokenPurpose;
import com.yuhan.wagglewaggle.domain.onboarding.service.OnboardingSessionService;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import io.jsonwebtoken.Claims;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private OAuthClientResolver oAuthClientResolver;
    @Mock
    private SocialAccountService socialAccountService;
    @Mock
    private RefreshTokenService refreshTokenService;
    @Mock
    private OnboardingSessionService onboardingSessionService;
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
        given(jwtProvider.getOnboardingTokenExpirationSeconds()).willReturn(600L);
        given(jwtProvider.createOnboardingToken(eq(10L), eq(OAuthProvider.KAKAO), anyString()))
                .willReturn("onboarding-jwt");

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

    // ===== 토큰 재발급 =====

    private static final Long MEMBER_ID = 99L;

    /** parse → REFRESH purpose → subject=MEMBER_ID 까지의 공통 스텁 */
    private void givenValidRefreshToken(String token) {
        Claims claims = mock(Claims.class);
        given(jwtProvider.parse(token)).willReturn(claims);
        given(jwtProvider.getPurpose(claims)).willReturn(TokenPurpose.REFRESH);
        given(claims.getSubject()).willReturn(String.valueOf(MEMBER_ID));
    }

    @Test
    void refresh_토큰_누락이면_REFRESH_TOKEN_REQUIRED() {
        assertThatThrownBy(() -> authService.refresh(new TokenRefreshRequest("  ")))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.REFRESH_TOKEN_REQUIRED);

        assertThatThrownBy(() -> authService.refresh(null))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.REFRESH_TOKEN_REQUIRED);
    }

    @Test
    void refresh_파싱실패면_INVALID_REFRESH_TOKEN() {
        given(jwtProvider.parse("bad-token")).willThrow(new RuntimeException("서명 오류"));

        assertThatThrownBy(() -> authService.refresh(new TokenRefreshRequest("bad-token")))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.INVALID_REFRESH_TOKEN);
    }

    @Test
    void refresh_purpose가_REFRESH가_아니면_INVALID_REFRESH_TOKEN() {
        Claims claims = mock(Claims.class);
        given(jwtProvider.parse("access-token")).willReturn(claims);
        given(jwtProvider.getPurpose(claims)).willReturn(TokenPurpose.ACCESS);

        assertThatThrownBy(() -> authService.refresh(new TokenRefreshRequest("access-token")))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.INVALID_REFRESH_TOKEN);
    }

    @Test
    void refresh_서버에_없는_토큰이면_INVALID_REFRESH_TOKEN() {
        givenValidRefreshToken("refresh-jwt");
        given(jwtProvider.createAccessToken(MEMBER_ID)).willReturn("new-access");
        given(jwtProvider.createRefreshToken(MEMBER_ID)).willReturn("new-refresh");
        given(jwtProvider.getRefreshTokenExpirationSeconds()).willReturn(1209600L);
        given(refreshTokenService.rotate(eq(MEMBER_ID), any(), any(), any()))
                .willReturn(RotationOutcome.NOT_FOUND);

        assertThatThrownBy(() -> authService.refresh(new TokenRefreshRequest("refresh-jwt")))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.INVALID_REFRESH_TOKEN);
    }

    @Test
    void refresh_재사용감지면_REFRESH_TOKEN_REUSED() {
        givenValidRefreshToken("refresh-jwt");
        given(jwtProvider.createAccessToken(MEMBER_ID)).willReturn("new-access");
        given(jwtProvider.createRefreshToken(MEMBER_ID)).willReturn("new-refresh");
        given(jwtProvider.getRefreshTokenExpirationSeconds()).willReturn(1209600L);
        given(refreshTokenService.rotate(eq(MEMBER_ID), any(), any(), any()))
                .willReturn(RotationOutcome.REUSE_DETECTED);

        assertThatThrownBy(() -> authService.refresh(new TokenRefreshRequest("refresh-jwt")))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.REFRESH_TOKEN_REUSED);
    }

    @Test
    void refresh_정상이면_새_토큰과_만료초_반환() {
        givenValidRefreshToken("refresh-jwt");
        given(jwtProvider.createAccessToken(MEMBER_ID)).willReturn("new-access");
        given(jwtProvider.createRefreshToken(MEMBER_ID)).willReturn("new-refresh");
        given(jwtProvider.getAccessTokenExpirationSeconds()).willReturn(3600L);
        given(jwtProvider.getRefreshTokenExpirationSeconds()).willReturn(1209600L);
        given(refreshTokenService.rotate(eq(MEMBER_ID), any(), any(), any()))
                .willReturn(RotationOutcome.ROTATED);

        TokenRefreshResponse response = authService.refresh(new TokenRefreshRequest("refresh-jwt"));

        assertEquals("new-access", response.accessToken());
        assertEquals(3600L, response.accessTokenExpiresIn());
        assertEquals("new-refresh", response.refreshToken());
        assertEquals(1209600L, response.refreshTokenExpiresIn());
        assertThat(response.refreshToken()).isNotEqualTo("refresh-jwt");
    }

    @Test
    void refresh_회전중_예상외_예외면_TOKEN_REFRESH_FAILED() {
        givenValidRefreshToken("refresh-jwt");
        given(jwtProvider.createAccessToken(MEMBER_ID)).willReturn("new-access");
        given(jwtProvider.createRefreshToken(MEMBER_ID)).willReturn("new-refresh");
        given(jwtProvider.getRefreshTokenExpirationSeconds()).willReturn(1209600L);
        given(refreshTokenService.rotate(eq(MEMBER_ID), any(), any(), any()))
                .willThrow(new RuntimeException("DB 오류"));

        assertThatThrownBy(() -> authService.refresh(new TokenRefreshRequest("refresh-jwt")))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.TOKEN_REFRESH_FAILED);
    }
}
