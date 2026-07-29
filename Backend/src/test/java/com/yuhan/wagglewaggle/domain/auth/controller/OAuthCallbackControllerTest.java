package com.yuhan.wagglewaggle.domain.auth.controller;

import com.yuhan.wagglewaggle.global.exception.GlobalExceptionHandler;
import com.yuhan.wagglewaggle.global.properties.AppOAuthProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class OAuthCallbackControllerTest {

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        AppOAuthProperties properties = new AppOAuthProperties("waglewagle");
        mockMvc = MockMvcBuilders.standaloneSetup(new OAuthCallbackController(properties))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void 정상_콜백이면_앱_스킴으로_302_리다이렉트() throws Exception {
        mockMvc.perform(get("/oauth/callback/kakao")
                        .param("code", "auth-code")
                        .param("state", "state-value"))
                .andExpect(status().isFound())
                .andExpect(header().string("Location",
                        "waglewagle://oauth/callback/kakao?code=auth-code&state=state-value"));
    }

    @Test
    void provider_표기는_소문자로_정규화된다() throws Exception {
        mockMvc.perform(get("/oauth/callback/NAVER")
                        .param("code", "c")
                        .param("state", "s"))
                .andExpect(status().isFound())
                .andExpect(header().string("Location",
                        "waglewagle://oauth/callback/naver?code=c&state=s"));
    }

    @Test
    void code와_state는_URL_인코딩된다() throws Exception {
        mockMvc.perform(get("/oauth/callback/kakao")
                        .param("code", "a b&c")
                        .param("state", "x/y"))
                .andExpect(status().isFound())
                .andExpect(header().string("Location",
                        "waglewagle://oauth/callback/kakao?code=a%20b%26c&state=x/y"));
    }

    @Test
    void 프로바이더_에러는_그대로_앱으로_전달된다() throws Exception {
        mockMvc.perform(get("/oauth/callback/kakao")
                        .param("error", "access_denied")
                        .param("error_description", "user denied"))
                .andExpect(status().isFound())
                .andExpect(header().string("Location",
                        "waglewagle://oauth/callback/kakao?error=access_denied&error_description=user%20denied"));
    }

    @Test
    void code도_error도_없으면_invalid_request로_표시한다() throws Exception {
        mockMvc.perform(get("/oauth/callback/kakao"))
                .andExpect(status().isFound())
                .andExpect(header().string("Location",
                        "waglewagle://oauth/callback/kakao?error=invalid_request"));
    }

    @Test
    void 지원하지_않는_provider면_400_에러코드() throws Exception {
        mockMvc.perform(get("/oauth/callback/google")
                        .param("code", "c")
                        .param("state", "s"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("AUTH_PROVIDER_INVALID"));
    }
}
