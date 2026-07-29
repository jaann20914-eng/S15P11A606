package com.yuhan.wagglewaggle.domain.auth.controller;

import com.yuhan.wagglewaggle.domain.auth.dto.OAuthLoginResponse;
import com.yuhan.wagglewaggle.domain.auth.dto.TokenRefreshResponse;
import com.yuhan.wagglewaggle.domain.auth.service.AuthService;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import com.yuhan.wagglewaggle.global.exception.GlobalExceptionHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AuthControllerTest {

    private AuthService authService;
    private MockMvc mockMvc;

    private static final String BODY = """
            {"authorizationCode":"auth-code","state":"state-value"}
            """;

    @BeforeEach
    void setUp() {
        authService = Mockito.mock(AuthService.class);
        mockMvc = MockMvcBuilders.standaloneSetup(new AuthController(authService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void 기존회원_로그인완료_응답() throws Exception {
        given(authService.login(eq("kakao"), any()))
                .willReturn(OAuthLoginResponse.authenticated("access-jwt", "refresh-jwt"));

        mockMvc.perform(post("/api/v1/auth/oauth/kakao")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(BODY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.statusCode").value(200))
                .andExpect(jsonPath("$.message").value("OAuth 로그인이 완료되었습니다."))
                .andExpect(jsonPath("$.data.authStatus").value("AUTHENTICATED"))
                .andExpect(jsonPath("$.data.accessToken").value("access-jwt"))
                .andExpect(jsonPath("$.data.refreshToken").value("refresh-jwt"))
                .andExpect(jsonPath("$.data.onboardingToken").doesNotExist());
    }

    @Test
    void 온보딩필요_응답() throws Exception {
        given(authService.login(eq("naver"), any()))
                .willReturn(OAuthLoginResponse.onboardingRequired("onboarding-jwt"));

        mockMvc.perform(post("/api/v1/auth/oauth/naver")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(BODY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("온보딩이 필요합니다."))
                .andExpect(jsonPath("$.data.authStatus").value("ONBOARDING_REQUIRED"))
                .andExpect(jsonPath("$.data.onboardingToken").value("onboarding-jwt"))
                .andExpect(jsonPath("$.data.accessToken").doesNotExist())
                .andExpect(jsonPath("$.data.refreshToken").doesNotExist());
    }

    @Test
    void 지원하지않는_provider면_400_에러코드() throws Exception {
        given(authService.login(eq("google"), any()))
                .willThrow(new CustomException(ErrorCode.AUTH_PROVIDER_INVALID));

        mockMvc.perform(post("/api/v1/auth/oauth/google")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(BODY))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.statusCode").value(400))
                .andExpect(jsonPath("$.error.code").value("AUTH_PROVIDER_INVALID"));
    }

    // ===== 토큰 재발급 =====

    private static final String REFRESH_BODY = """
            {"refreshToken":"refresh-jwt"}
            """;

    @Test
    void 토큰_재발급_성공_응답() throws Exception {
        given(authService.refresh(any()))
                .willReturn(new TokenRefreshResponse("new-access", 3600L, "new-refresh", 1209600L));

        mockMvc.perform(post("/api/v1/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(REFRESH_BODY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.statusCode").value(200))
                .andExpect(jsonPath("$.message").value("액세스 토큰과 리프레시 토큰이 재발급되었습니다."))
                .andExpect(jsonPath("$.data.accessToken").value("new-access"))
                .andExpect(jsonPath("$.data.accessTokenExpiresIn").value(3600))
                .andExpect(jsonPath("$.data.refreshToken").value("new-refresh"))
                .andExpect(jsonPath("$.data.refreshTokenExpiresIn").value(1209600));
    }

    @Test
    void 리프레시_토큰_누락시_400_REFRESH_TOKEN_REQUIRED() throws Exception {
        given(authService.refresh(any()))
                .willThrow(new CustomException(ErrorCode.REFRESH_TOKEN_REQUIRED));

        mockMvc.perform(post("/api/v1/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.statusCode").value(400))
                .andExpect(jsonPath("$.error.code").value("REFRESH_TOKEN_REQUIRED"));
    }

    @Test
    void 유효하지_않은_리프레시_토큰이면_401() throws Exception {
        given(authService.refresh(any()))
                .willThrow(new CustomException(ErrorCode.INVALID_REFRESH_TOKEN));

        mockMvc.perform(post("/api/v1/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(REFRESH_BODY))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.statusCode").value(401))
                .andExpect(jsonPath("$.error.code").value("INVALID_REFRESH_TOKEN"));
    }

    @Test
    void 리프레시_토큰_재사용_감지시_401() throws Exception {
        given(authService.refresh(any()))
                .willThrow(new CustomException(ErrorCode.REFRESH_TOKEN_REUSED));

        mockMvc.perform(post("/api/v1/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(REFRESH_BODY))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.statusCode").value(401))
                .andExpect(jsonPath("$.error.code").value("REFRESH_TOKEN_REUSED"));
    }
}
