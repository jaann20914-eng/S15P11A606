package com.yuhan.wagglewaggle.domain.pin.controller;

import com.yuhan.wagglewaggle.domain.pin.dto.PinCreateRequest;
import com.yuhan.wagglewaggle.domain.pin.dto.PinCreateResponse;
import com.yuhan.wagglewaggle.domain.pin.dto.PinUploadUrlRequest;
import com.yuhan.wagglewaggle.domain.pin.dto.PinVideoUploadUrlResponse;
import com.yuhan.wagglewaggle.domain.pin.entity.VideoStatus;
import com.yuhan.wagglewaggle.domain.pin.service.PinCreateService;
import com.yuhan.wagglewaggle.domain.pin.service.PinVideoUploadService;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import com.yuhan.wagglewaggle.global.exception.GlobalExceptionHandler;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Instant;
import java.util.Collections;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class PinControllerTest {

    private PinVideoUploadService pinVideoUploadService;
    private PinCreateService pinCreateService;
    private MockMvc mockMvc;

    private static final Long MEMBER_ID = 42L;
    private static final String BODY = """
            {"contentType":"video/mp4","fileSize":5242880}
            """;

    @BeforeEach
    void setUp() {
        pinVideoUploadService = Mockito.mock(PinVideoUploadService.class);
        pinCreateService = Mockito.mock(PinCreateService.class);
        mockMvc = MockMvcBuilders.standaloneSetup(new PinController(pinVideoUploadService, pinCreateService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .setCustomArgumentResolvers(new AuthenticationPrincipalArgumentResolver())
                .build();

        // @AuthenticationPrincipal Long memberId 해석용 인증 컨텍스트
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(MEMBER_ID, null, Collections.emptyList()));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void 발급_성공시_200과_응답형식을_반환한다() throws Exception {
        Instant expiresAt = Instant.parse("2026-07-31T00:10:00Z");
        given(pinVideoUploadService.issueOriginalVideoUploadUrl(eq(MEMBER_ID), any()))
                .willReturn(new PinVideoUploadUrlResponse(
                        "https://test-bucket.s3.ap-northeast-2.amazonaws.com/upload?sig=abc",
                        "pins/original/42/11111111-2222-3333-4444-555555555555.mp4",
                        expiresAt));

        mockMvc.perform(post("/api/v1/pins/upload-url")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(BODY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.statusCode").value(200))
                .andExpect(jsonPath("$.message").value("영상 업로드 정보가 발급되었습니다."))
                .andExpect(jsonPath("$.data.uploadUrl")
                        .value("https://test-bucket.s3.ap-northeast-2.amazonaws.com/upload?sig=abc"))
                .andExpect(jsonPath("$.data.originalVideoKey")
                        .value("pins/original/42/11111111-2222-3333-4444-555555555555.mp4"))
                .andExpect(jsonPath("$.data.expiresAt").value("2026-07-31T00:10:00Z"));

        // 인증된 memberId가 서비스로 전달된다.
        verify(pinVideoUploadService).issueOriginalVideoUploadUrl(eq(MEMBER_ID), any(PinUploadUrlRequest.class));
    }

    @Test
    void 잘못된_요청이면_400과_INVALID_UPLOAD_REQUEST를_반환한다() throws Exception {
        given(pinVideoUploadService.issueOriginalVideoUploadUrl(any(), any()))
                .willThrow(new CustomException(ErrorCode.INVALID_UPLOAD_REQUEST));

        mockMvc.perform(post("/api/v1/pins/upload-url")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"contentType\":\"image/png\",\"fileSize\":5242880}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.statusCode").value(400))
                .andExpect(jsonPath("$.error.code").value("INVALID_UPLOAD_REQUEST"));
    }

    @Test
    void 발급_처리_실패면_500과_UPLOAD_URL_ISSUE_FAILED를_반환한다() throws Exception {
        given(pinVideoUploadService.issueOriginalVideoUploadUrl(any(), any()))
                .willThrow(new CustomException(ErrorCode.UPLOAD_URL_ISSUE_FAILED));

        mockMvc.perform(post("/api/v1/pins/upload-url")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(BODY))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.statusCode").value(500))
                .andExpect(jsonPath("$.error.code").value("UPLOAD_URL_ISSUE_FAILED"));
    }

    @Test
    void 핀_등록_접수시_202와_pinId_videoStatus를_반환한다() throws Exception {
        java.util.UUID pinId = java.util.UUID.fromString("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
        given(pinCreateService.create(eq(MEMBER_ID), any(PinCreateRequest.class)))
                .willReturn(new PinCreateResponse(pinId, VideoStatus.PENDING));

        mockMvc.perform(post("/api/v1/pins")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"originalVideoKey\":\"k\",\"kakaoPlaceId\":\"p\"}"))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.statusCode").value(202))
                .andExpect(jsonPath("$.message").value("영상 핀 등록 요청이 접수되었습니다."))
                .andExpect(jsonPath("$.data.pinId").value(pinId.toString()))
                .andExpect(jsonPath("$.data.videoStatus").value("PENDING"));

        // 인증된 memberId가 서비스로 전달된다.
        verify(pinCreateService).create(eq(MEMBER_ID), any(PinCreateRequest.class));
    }

    @Test
    void 핀_등록_검증_실패시_해당_오류코드를_반환한다() throws Exception {
        given(pinCreateService.create(any(), any()))
                .willThrow(new CustomException(ErrorCode.VIDEO_NOT_ACCESSIBLE));

        mockMvc.perform(post("/api/v1/pins")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"originalVideoKey\":\"k\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.statusCode").value(400))
                .andExpect(jsonPath("$.error.code").value("VIDEO_NOT_ACCESSIBLE"));
    }

    @Test
    void 핀_저장_실패시_500과_PIN_CREATE_FAILED를_반환한다() throws Exception {
        given(pinCreateService.create(any(), any()))
                .willThrow(new CustomException(ErrorCode.PIN_CREATE_FAILED));

        mockMvc.perform(post("/api/v1/pins")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"originalVideoKey\":\"k\"}"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.statusCode").value(500))
                .andExpect(jsonPath("$.error.code").value("PIN_CREATE_FAILED"));
    }
}
