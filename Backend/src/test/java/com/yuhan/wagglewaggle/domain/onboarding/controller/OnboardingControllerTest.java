package com.yuhan.wagglewaggle.domain.onboarding.controller;

import com.yuhan.wagglewaggle.domain.onboarding.dto.OnboardingResponse;
import com.yuhan.wagglewaggle.domain.onboarding.service.OnboardingService;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import com.yuhan.wagglewaggle.global.exception.GlobalExceptionHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class OnboardingControllerTest {

    private OnboardingService onboardingService;
    private MockMvc mockMvc;

    private static final String BODY = """
            {"ageGroup":"TWENTIES","gender":"FEMALE","nickname":"와글러","preferredCategories":["CAFE","RESTAURANT"]}
            """;

    @BeforeEach
    void setUp() {
        onboardingService = Mockito.mock(OnboardingService.class);
        mockMvc = MockMvcBuilders.standaloneSetup(new OnboardingController(onboardingService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void 온보딩_완료시_201과_응답형식을_반환한다() throws Exception {
        given(onboardingService.complete(any(), any()))
                .willReturn(new OnboardingResponse(1L, java.math.BigDecimal.valueOf(90), 10, true, "access-jwt", "refresh-raw"));

        mockMvc.perform(post("/api/v1/onboarding")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer onboarding-jwt")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(BODY))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.statusCode").value(201))
                .andExpect(jsonPath("$.message").value("온보딩이 완료되었습니다."))
                .andExpect(jsonPath("$.data.memberId").value(1))
                .andExpect(jsonPath("$.data.viewAngle").value(90))
                .andExpect(jsonPath("$.data.creditBalance").value(10))
                .andExpect(jsonPath("$.data.onboardingCompleted").value(true))
                .andExpect(jsonPath("$.data.accessToken").value("access-jwt"))
                .andExpect(jsonPath("$.data.refreshToken").value("refresh-raw"));
    }

    @Test
    void 입력값_오류면_400_INVALID_ONBOARDING_REQUEST() throws Exception {
        given(onboardingService.complete(any(), any()))
                .willThrow(new CustomException(ErrorCode.INVALID_ONBOARDING_REQUEST));

        mockMvc.perform(post("/api/v1/onboarding")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer onboarding-jwt")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(BODY))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.statusCode").value(400))
                .andExpect(jsonPath("$.error.code").value("INVALID_ONBOARDING_REQUEST"));
    }

    @Test
    void 유효하지_않은_토큰이면_401_INVALID_ONBOARDING_TOKEN() throws Exception {
        given(onboardingService.complete(any(), any()))
                .willThrow(new CustomException(ErrorCode.INVALID_ONBOARDING_TOKEN));

        mockMvc.perform(post("/api/v1/onboarding")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(BODY))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.statusCode").value(401))
                .andExpect(jsonPath("$.error.code").value("INVALID_ONBOARDING_TOKEN"));
    }

    @Test
    void 이미_사용된_토큰이면_401_ONBOARDING_TOKEN_ALREADY_USED() throws Exception {
        given(onboardingService.complete(any(), any()))
                .willThrow(new CustomException(ErrorCode.ONBOARDING_TOKEN_ALREADY_USED));

        mockMvc.perform(post("/api/v1/onboarding")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer onboarding-jwt")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(BODY))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error.code").value("ONBOARDING_TOKEN_ALREADY_USED"));
    }

    @Test
    void 닉네임_중복이면_409_NICKNAME_ALREADY_EXISTS() throws Exception {
        given(onboardingService.complete(any(), any()))
                .willThrow(new CustomException(ErrorCode.NICKNAME_ALREADY_EXISTS));

        mockMvc.perform(post("/api/v1/onboarding")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer onboarding-jwt")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(BODY))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.statusCode").value(409))
                .andExpect(jsonPath("$.error.code").value("NICKNAME_ALREADY_EXISTS"));
    }

    @Test
    void 이미_온보딩_완료면_409_ONBOARDING_ALREADY_COMPLETED() throws Exception {
        given(onboardingService.complete(any(), any()))
                .willThrow(new CustomException(ErrorCode.ONBOARDING_ALREADY_COMPLETED));

        mockMvc.perform(post("/api/v1/onboarding")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer onboarding-jwt")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(BODY))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error.code").value("ONBOARDING_ALREADY_COMPLETED"));
    }
}
