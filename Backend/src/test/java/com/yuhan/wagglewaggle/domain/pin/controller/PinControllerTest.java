package com.yuhan.wagglewaggle.domain.pin.controller;

import com.yuhan.wagglewaggle.domain.pin.dto.PinCreateRequest;
import com.yuhan.wagglewaggle.domain.pin.dto.PinCreateResponse;
import com.yuhan.wagglewaggle.domain.pin.dto.PinUploadUrlRequest;
import com.yuhan.wagglewaggle.domain.pin.dto.PinVideoStatusResponse;
import com.yuhan.wagglewaggle.domain.pin.dto.PinVideoStatusView;
import com.yuhan.wagglewaggle.domain.pin.dto.PinVideoUploadUrlResponse;
import com.yuhan.wagglewaggle.domain.pin.entity.VideoStatus;
import com.yuhan.wagglewaggle.domain.pin.service.PinCreateService;
import com.yuhan.wagglewaggle.domain.pin.service.PinVideoStatusQueryService;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class PinControllerTest {

    private PinVideoUploadService pinVideoUploadService;
    private PinCreateService pinCreateService;
    private PinVideoStatusQueryService pinVideoStatusQueryService;
    private MockMvc mockMvc;

    private static final Long MEMBER_ID = 42L;
    private static final String BODY = """
            {"contentType":"video/mp4","fileSize":5242880}
            """;

    @BeforeEach
    void setUp() {
        pinVideoUploadService = Mockito.mock(PinVideoUploadService.class);
        pinCreateService = Mockito.mock(PinCreateService.class);
        pinVideoStatusQueryService = Mockito.mock(PinVideoStatusQueryService.class);
        mockMvc = MockMvcBuilders.standaloneSetup(
                        new PinController(pinVideoUploadService, pinCreateService, pinVideoStatusQueryService))
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

    // ---------- 상태 조회 ----------

    private static final String PIN_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

    @Test
    void 상태_조회_ACTIVE면_200과_영상_URL을_함께_반환한다() throws Exception {
        java.util.UUID pinId = java.util.UUID.fromString(PIN_ID);
        given(pinVideoStatusQueryService.getVideoStatus(eq(MEMBER_ID), eq(pinId)))
                .willReturn(new PinVideoStatusView(
                        "영상 처리가 완료되었습니다.",
                        PinVideoStatusResponse.withUrls(pinId,
                                "https://bucket.s3/blurred?sig=v", "https://bucket.s3/thumb?sig=t")));

        mockMvc.perform(get("/api/v1/pins/{pinId}/status", PIN_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.statusCode").value(200))
                .andExpect(jsonPath("$.message").value("영상 처리가 완료되었습니다."))
                .andExpect(jsonPath("$.data.pinId").value(PIN_ID))
                .andExpect(jsonPath("$.data.videoStatus").value("ACTIVE"))
                .andExpect(jsonPath("$.data.videoUrl").value("https://bucket.s3/blurred?sig=v"))
                .andExpect(jsonPath("$.data.thumbnailUrl").value("https://bucket.s3/thumb?sig=t"))
                // Object Storage Key는 ACTIVE 응답에도 노출하지 않는다.
                .andExpect(jsonPath("$.data.blurredVideoKey").doesNotExist())
                .andExpect(jsonPath("$.data.thumbnailKey").doesNotExist())
                .andExpect(jsonPath("$.data.originalVideoKey").doesNotExist());

        verify(pinVideoStatusQueryService).getVideoStatus(eq(MEMBER_ID), eq(pinId));
    }

    @Test
    void 상태_조회_PENDING이면_200과_null_URL을_반환하고_객체_키는_노출하지_않는다() throws Exception {
        java.util.UUID pinId = java.util.UUID.fromString(PIN_ID);
        given(pinVideoStatusQueryService.getVideoStatus(eq(MEMBER_ID), eq(pinId)))
                .willReturn(new PinVideoStatusView(
                        "영상 처리 상태를 조회했습니다.",
                        PinVideoStatusResponse.withoutUrls(pinId, VideoStatus.PENDING)));

        mockMvc.perform(get("/api/v1/pins/{pinId}/status", PIN_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("영상 처리 상태를 조회했습니다."))
                .andExpect(jsonPath("$.data.videoStatus").value("PENDING"))
                .andExpect(jsonPath("$.data.videoUrl").doesNotExist())
                .andExpect(jsonPath("$.data.thumbnailUrl").doesNotExist())
                .andExpect(jsonPath("$.data.blurredVideoKey").doesNotExist())
                .andExpect(jsonPath("$.data.thumbnailKey").doesNotExist())
                .andExpect(jsonPath("$.data.originalVideoKey").doesNotExist());
    }

    @Test
    void 상태_조회_잘못된_UUID면_400과_INVALID_REQUEST를_반환한다() throws Exception {
        mockMvc.perform(get("/api/v1/pins/{pinId}/status", "not-a-uuid"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.statusCode").value(400))
                .andExpect(jsonPath("$.error.code").value("INVALID_REQUEST"));
    }

    @Test
    void 상태_조회_다른_사용자_핀이면_403과_PIN_STATUS_READ_FORBIDDEN을_반환한다() throws Exception {
        given(pinVideoStatusQueryService.getVideoStatus(any(), any()))
                .willThrow(new CustomException(ErrorCode.PIN_STATUS_READ_FORBIDDEN));

        mockMvc.perform(get("/api/v1/pins/{pinId}/status", PIN_ID))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.statusCode").value(403))
                .andExpect(jsonPath("$.error.code").value("PIN_STATUS_READ_FORBIDDEN"));
    }

    @Test
    void 상태_조회_핀이_없으면_404와_PIN_NOT_FOUND를_반환한다() throws Exception {
        given(pinVideoStatusQueryService.getVideoStatus(any(), any()))
                .willThrow(new CustomException(ErrorCode.PIN_NOT_FOUND));

        mockMvc.perform(get("/api/v1/pins/{pinId}/status", PIN_ID))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.statusCode").value(404))
                .andExpect(jsonPath("$.error.code").value("PIN_NOT_FOUND"));
    }

    @Test
    void 상태_조회_처리_실패면_500과_PIN_STATUS_READ_FAILED를_반환한다() throws Exception {
        given(pinVideoStatusQueryService.getVideoStatus(any(), any()))
                .willThrow(new CustomException(ErrorCode.PIN_STATUS_READ_FAILED));

        mockMvc.perform(get("/api/v1/pins/{pinId}/status", PIN_ID))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.statusCode").value(500))
                .andExpect(jsonPath("$.error.code").value("PIN_STATUS_READ_FAILED"));
    }
}
