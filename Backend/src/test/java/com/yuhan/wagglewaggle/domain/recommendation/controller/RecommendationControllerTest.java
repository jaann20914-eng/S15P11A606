package com.yuhan.wagglewaggle.domain.recommendation.controller;

import com.yuhan.wagglewaggle.domain.recommendation.dto.LocationSource;
import com.yuhan.wagglewaggle.domain.recommendation.dto.PinPreview;
import com.yuhan.wagglewaggle.domain.recommendation.dto.PlaceCard;
import com.yuhan.wagglewaggle.domain.recommendation.dto.RecommendationResponse;
import com.yuhan.wagglewaggle.domain.recommendation.service.RecommendationService;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import com.yuhan.wagglewaggle.global.exception.GlobalExceptionHandler;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class RecommendationControllerTest {

    private static final Long MEMBER_ID = 42L;
    private static final UUID PIN_ID = UUID.fromString("15ab5bf8-3395-49ee-a046-32d51373ffab");

    private RecommendationService recommendationService;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        recommendationService = Mockito.mock(RecommendationService.class);
        mockMvc = MockMvcBuilders.standaloneSetup(new RecommendationController(recommendationService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver())
                .build();
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(MEMBER_ID, null, Collections.emptyList()));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("추천 성공 시 200과 응답 형식을 반환하고 인증 사용자·좌표·limit을 서비스로 전달한다")
    void getRecommendations_success() throws Exception {
        RecommendationResponse response = new RecommendationResponse(
                LocationSource.CURRENT_GPS,
                OffsetDateTime.of(2026, 8, 4, 10, 0, 0, 0, ZoneOffset.ofHours(9)),
                new RecommendationResponse.Recommendations(
                        List.of(new PlaceCard(1L, "성수 연무장길", "서울 성동구 연무장길", "02-1234-5678",
                                13, 9, "감지카메라", List.of(new PinPreview(PIN_ID, 320.0)))),
                        List.of()));
        given(recommendationService.recommend(eq(MEMBER_ID), eq(37.5006), eq(127.0364), eq(5)))
                .willReturn(response);

        mockMvc.perform(get("/api/v1/recommendations/places")
                        .param("latitude", "37.5006")
                        .param("longitude", "127.0364")
                        .param("limit", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.statusCode").value(200))
                .andExpect(jsonPath("$.message").value("개인화 장소 추천이 완료되었습니다."))
                .andExpect(jsonPath("$.data.locationSource").value("CURRENT_GPS"))
                .andExpect(jsonPath("$.data.generatedAt").value("2026-08-04T10:00:00+09:00"))
                .andExpect(jsonPath("$.data.recommendations.relaxed[0].placeId").value(1))
                .andExpect(jsonPath("$.data.recommendations.relaxed[0].phone").value("02-1234-5678"))
                .andExpect(jsonPath("$.data.recommendations.relaxed[0].pinPreviews[0].pinId").value(PIN_ID.toString()))
                .andExpect(jsonPath("$.data.recommendations.relaxed[0].pinPreviews[0].uploaderViewAngle").value(320.0))
                .andExpect(jsonPath("$.data.recommendations.wagle").isEmpty());

        verify(recommendationService).recommend(MEMBER_ID, 37.5006, 127.0364, 5);
    }

    @Test
    @DisplayName("좌표 없이 호출하면 좌표는 null로 서비스에 전달된다")
    void getRecommendations_noParams_passesNulls() throws Exception {
        given(recommendationService.recommend(eq(MEMBER_ID), any(), any(), any()))
                .willReturn(new RecommendationResponse(LocationSource.CACHED_GPS,
                        OffsetDateTime.of(2026, 8, 4, 10, 0, 0, 0, ZoneOffset.ofHours(9)),
                        new RecommendationResponse.Recommendations(List.of(), List.of())));

        mockMvc.perform(get("/api/v1/recommendations/places"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.locationSource").value("CACHED_GPS"));

        verify(recommendationService).recommend(MEMBER_ID, null, null, null);
    }

    @Test
    @DisplayName("INVALID_LOCATION은 400과 코드로 매핑된다")
    void getRecommendations_invalidLocation_400() throws Exception {
        given(recommendationService.recommend(any(), any(), any(), any()))
                .willThrow(new CustomException(ErrorCode.INVALID_LOCATION));

        mockMvc.perform(get("/api/v1/recommendations/places").param("latitude", "37.5"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("INVALID_LOCATION"));
    }

    @Test
    @DisplayName("LOCATION_NOT_AVAILABLE는 400과 코드로 매핑된다")
    void getRecommendations_locationNotAvailable_400() throws Exception {
        given(recommendationService.recommend(any(), any(), any(), any()))
                .willThrow(new CustomException(ErrorCode.LOCATION_NOT_AVAILABLE));

        mockMvc.perform(get("/api/v1/recommendations/places"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("LOCATION_NOT_AVAILABLE"));
    }

    @Test
    @DisplayName("좌표 형식 오류(숫자 아님)는 INVALID_LOCATION(400)으로 매핑된다")
    void getRecommendations_malformedCoordinate_invalidLocation() throws Exception {
        mockMvc.perform(get("/api/v1/recommendations/places")
                        .param("latitude", "abc").param("longitude", "127.0364"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error.code").value("INVALID_LOCATION"));
    }

    @Test
    @DisplayName("AI_RECOMMENDATION_FAILED는 502와 코드로 매핑된다")
    void getRecommendations_aiFailed_502() throws Exception {
        given(recommendationService.recommend(any(), any(), any(), any()))
                .willThrow(new CustomException(ErrorCode.AI_RECOMMENDATION_FAILED));

        mockMvc.perform(get("/api/v1/recommendations/places")
                        .param("latitude", "37.5006").param("longitude", "127.0364"))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.error.code").value("AI_RECOMMENDATION_FAILED"));
    }
}
