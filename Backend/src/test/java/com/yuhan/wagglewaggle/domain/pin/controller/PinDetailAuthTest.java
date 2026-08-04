package com.yuhan.wagglewaggle.domain.pin.controller;

import com.yuhan.wagglewaggle.domain.auth.jwt.JwtProvider;
import com.yuhan.wagglewaggle.domain.pin.service.PinCreateService;
import com.yuhan.wagglewaggle.domain.pin.service.PinDeleteService;
import com.yuhan.wagglewaggle.domain.pin.service.PinDetailService;
import com.yuhan.wagglewaggle.domain.pin.service.PinEvaluationService;
import com.yuhan.wagglewaggle.domain.pin.service.PinPublisherLeaveService;
import com.yuhan.wagglewaggle.domain.pin.service.PinUnlockService;
import com.yuhan.wagglewaggle.domain.pin.service.PinUpdateService;
import com.yuhan.wagglewaggle.domain.pin.service.PinVideoStatusQueryService;
import com.yuhan.wagglewaggle.domain.pin.service.PinVideoUploadService;
import com.yuhan.wagglewaggle.global.config.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.jpa.mapping.JpaMetamodelMappingContext;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 실제 SecurityConfig 필터체인을 태워 인증 실패(401) 응답 형식을 검증한다.
 * Access Token 없이 보호 경로(GET /api/v1/pins/{pinId})를 호출하면
 * {"statusCode":401,"message":"인증이 필요합니다.","error":{"code":"UNAUTHORIZED"}}를 반환해야 한다.
 */
@WebMvcTest(PinController.class)
@Import(SecurityConfig.class)
class PinDetailAuthTest {

    @Autowired private MockMvc mockMvc;

    @MockitoBean private JwtProvider jwtProvider;
    @MockitoBean private PinVideoUploadService pinVideoUploadService;
    @MockitoBean private PinCreateService pinCreateService;
    @MockitoBean private PinVideoStatusQueryService pinVideoStatusQueryService;
    @MockitoBean private PinDetailService pinDetailService;
    @MockitoBean private PinUpdateService pinUpdateService;
    @MockitoBean private PinDeleteService pinDeleteService;
    @MockitoBean private PinPublisherLeaveService pinPublisherLeaveService;
    @MockitoBean private PinEvaluationService pinEvaluationService;
    @MockitoBean private PinUnlockService pinUnlockService;

    // 메인의 JPA Auditing(@EnableJpaAuditing)이 요구하는 매핑 컨텍스트를 목으로 채워
    // WebMvc 슬라이스 컨텍스트 로딩을 통과시킨다(실제 JPA는 이 테스트에서 쓰지 않는다).
    @MockitoBean private JpaMetamodelMappingContext jpaMetamodelMappingContext;

    private static final String PIN_ID = "15ab5bf8-3395-49ee-a046-32d51373ffab";

    @Test
    void 인증_정보가_없으면_401과_UNAUTHORIZED_응답을_반환한다() throws Exception {
        mockMvc.perform(get("/api/v1/pins/{pinId}", PIN_ID))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.statusCode").value(401))
                .andExpect(jsonPath("$.message").value("인증이 필요합니다."))
                .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));
    }

    @Test
    void 유효하지_않은_토큰이면_401과_UNAUTHORIZED_응답을_반환한다() throws Exception {
        // 서명/형식 오류 등 → 필터가 인증을 설정하지 않아 EntryPoint가 401을 반환한다.
        org.mockito.BDDMockito.given(jwtProvider.parse("bad-token"))
                .willThrow(new RuntimeException("invalid token"));

        mockMvc.perform(get("/api/v1/pins/{pinId}", PIN_ID)
                        .header("Authorization", "Bearer bad-token"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.statusCode").value(401))
                .andExpect(jsonPath("$.message").value("인증이 필요합니다."))
                .andExpect(jsonPath("$.error.code").value("UNAUTHORIZED"));
    }
}
