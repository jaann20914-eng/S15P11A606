package com.yuhan.wagglewaggle.domain.pin.controller;

import com.yuhan.wagglewaggle.domain.pin.dto.ChatRequestState;
import com.yuhan.wagglewaggle.domain.pin.dto.PinCreateRequest;
import com.yuhan.wagglewaggle.domain.pin.dto.PinCreateResponse;
import com.yuhan.wagglewaggle.domain.pin.dto.PinDeleteResponse;
import com.yuhan.wagglewaggle.domain.pin.dto.PinDetailResponse;
import com.yuhan.wagglewaggle.domain.pin.dto.PinUpdateResponse;
import com.yuhan.wagglewaggle.domain.pin.dto.PinUploadUrlRequest;
import com.yuhan.wagglewaggle.domain.pin.dto.PinVideoStatusResponse;
import com.yuhan.wagglewaggle.domain.pin.dto.PinVideoStatusView;
import com.yuhan.wagglewaggle.domain.pin.dto.PinVideoUploadUrlResponse;
import com.yuhan.wagglewaggle.domain.pin.dto.VideoAccessLevel;
import com.yuhan.wagglewaggle.domain.pin.entity.CrowdLevel;
import com.yuhan.wagglewaggle.domain.pin.entity.VideoStatus;
import com.yuhan.wagglewaggle.domain.pin.service.PinCreateService;
import com.yuhan.wagglewaggle.domain.pin.service.PinDeleteService;
import com.yuhan.wagglewaggle.domain.pin.service.PinDetailService;
import com.yuhan.wagglewaggle.domain.pin.service.PinUpdateService;
import com.yuhan.wagglewaggle.domain.pin.service.PinVideoStatusQueryService;
import com.yuhan.wagglewaggle.domain.pin.service.PinVideoUploadService;

import java.util.List;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class PinControllerTest {

    private PinVideoUploadService pinVideoUploadService;
    private PinCreateService pinCreateService;
    private PinVideoStatusQueryService pinVideoStatusQueryService;
    private PinDetailService pinDetailService;
    private PinUpdateService pinUpdateService;
    private PinDeleteService pinDeleteService;
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
        pinDetailService = Mockito.mock(PinDetailService.class);
        pinUpdateService = Mockito.mock(PinUpdateService.class);
        pinDeleteService = Mockito.mock(PinDeleteService.class);
        mockMvc = MockMvcBuilders.standaloneSetup(
                        new PinController(pinVideoUploadService, pinCreateService,
                                pinVideoStatusQueryService, pinDetailService, pinUpdateService,
                                pinDeleteService))
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

        // VIDEO_NOT_ACCESSIBLE은 명세에 맞춰 422(UNPROCESSABLE_CONTENT)로 매핑된다(등록·수정 공용 코드).
        mockMvc.perform(post("/api/v1/pins")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"originalVideoKey\":\"k\"}"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.statusCode").value(422))
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

    // ---------- 핀 상세 조회 ----------

    private PinDetailResponse detailResponse() {
        return new PinDetailResponse(
                java.util.UUID.fromString(PIN_ID),
                java.math.BigDecimal.valueOf(90),
                "와글러",
                Instant.parse("2026-07-28T03:20:00Z"),
                new PinDetailResponse.PlaceDetail(
                        1L, "1372855768", "바나프레소 테헤란로점", 37.501123, 127.039625),
                CrowdLevel.WAGLE,
                "2층 창가 좌석",
                "점심시간 기준",
                List.of("조용함", "콘센트"),
                VideoAccessLevel.OWNER,
                null,
                "https://bucket.s3/blurred?sig=v",
                "https://bucket.s3/thumb?sig=t",
                false,
                ChatRequestState.NONE);
    }

    @Test
    void 상세_조회_성공시_200과_응답형식을_반환하고_객체키와_원본URL은_노출하지_않는다() throws Exception {
        given(pinDetailService.getPinDetail(eq(PIN_ID), eq(MEMBER_ID))).willReturn(detailResponse());

        mockMvc.perform(get("/api/v1/pins/{pinId}", PIN_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.statusCode").value(200))
                .andExpect(jsonPath("$.message").value("영상 핀 상세 조회가 완료되었습니다."))
                .andExpect(jsonPath("$.data.pinId").value(PIN_ID))
                .andExpect(jsonPath("$.data.authorViewAngle").value(90))
                .andExpect(jsonPath("$.data.authorNickname").value("와글러"))
                .andExpect(jsonPath("$.data.createdAt").value("2026-07-28T03:20:00Z"))
                .andExpect(jsonPath("$.data.place.placeId").value(1))
                .andExpect(jsonPath("$.data.place.kakaoPlaceId").value("1372855768"))
                .andExpect(jsonPath("$.data.place.name").value("바나프레소 테헤란로점"))
                .andExpect(jsonPath("$.data.place.latitude").value(37.501123))
                .andExpect(jsonPath("$.data.place.longitude").value(127.039625))
                .andExpect(jsonPath("$.data.crowdLevel").value("WAGLE"))
                .andExpect(jsonPath("$.data.detailLocation").value("2층 창가 좌석"))
                .andExpect(jsonPath("$.data.memo").value("점심시간 기준"))
                .andExpect(jsonPath("$.data.tags").isArray())
                .andExpect(jsonPath("$.data.tags[0]").value("조용함"))
                .andExpect(jsonPath("$.data.videoAccess").value("OWNER"))
                .andExpect(jsonPath("$.data.isEvaluated").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.data.videoUrl").value("https://bucket.s3/blurred?sig=v"))
                .andExpect(jsonPath("$.data.thumbnailUrl").value("https://bucket.s3/thumb?sig=t"))
                .andExpect(jsonPath("$.data.canRequestChat").value(false))
                .andExpect(jsonPath("$.data.chatRequestState").value("NONE"))
                // 보안: 객체 키·원본 URL·내부 memberId는 응답에 없다.
                .andExpect(jsonPath("$.data.blurredVideoKey").doesNotExist())
                .andExpect(jsonPath("$.data.thumbnailKey").doesNotExist())
                .andExpect(jsonPath("$.data.originalVideoKey").doesNotExist())
                .andExpect(jsonPath("$.data.originalVideoUrl").doesNotExist())
                .andExpect(jsonPath("$.data.memberId").doesNotExist());

        verify(pinDetailService).getPinDetail(eq(PIN_ID), eq(MEMBER_ID));
    }

    @Test
    void 상세_조회_isEvaluated는_null이면_필드가_null로_포함된다() throws Exception {
        // isEvaluated=null은 명시적으로 null로 직렬화되어야 한다(요구 예시와 동일).
        given(pinDetailService.getPinDetail(eq(PIN_ID), eq(MEMBER_ID))).willReturn(detailResponse());

        String json = mockMvc.perform(get("/api/v1/pins/{pinId}", PIN_ID))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        org.assertj.core.api.Assertions.assertThat(json).contains("\"isEvaluated\":null");
    }

    @Test
    void 상세_조회_detailLocation과_memo가_null이면_JSON에_null로_포함되고_tags는_빈배열이다() throws Exception {
        PinDetailResponse res = new PinDetailResponse(
                java.util.UUID.fromString(PIN_ID), java.math.BigDecimal.valueOf(90), "와글러",
                Instant.parse("2026-07-28T03:20:00Z"),
                new PinDetailResponse.PlaceDetail(1L, "1372855768", "바나프레소 테헤란로점", 37.501123, 127.039625),
                CrowdLevel.WAGLE, null, null, List.of(),
                VideoAccessLevel.OWNER, null,
                "https://bucket.s3/blurred?sig=v", "https://bucket.s3/thumb?sig=t",
                false, ChatRequestState.NONE);
        given(pinDetailService.getPinDetail(eq(PIN_ID), eq(MEMBER_ID))).willReturn(res);

        String json = mockMvc.perform(get("/api/v1/pins/{pinId}", PIN_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.detailLocation").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.data.memo").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.data.tags").isArray())
                .andExpect(jsonPath("$.data.tags").isEmpty())
                .andReturn().getResponse().getContentAsString();

        // 명세 예시처럼 null 필드는 생략되지 않고 명시적으로 직렬화된다.
        org.assertj.core.api.Assertions.assertThat(json)
                .contains("\"detailLocation\":null")
                .contains("\"memo\":null");
    }

    @Test
    void 상세_조회_잘못된_pinId_형식이면_400과_INVALID_PIN_ID를_반환한다() throws Exception {
        given(pinDetailService.getPinDetail(eq("not-a-uuid"), any()))
                .willThrow(new CustomException(ErrorCode.INVALID_PIN_ID));

        mockMvc.perform(get("/api/v1/pins/{pinId}", "not-a-uuid"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.statusCode").value(400))
                .andExpect(jsonPath("$.error.code").value("INVALID_PIN_ID"))
                .andExpect(jsonPath("$.message").value("핀 ID 형식이 올바르지 않습니다."));
    }

    @Test
    void 상세_조회_핀이_없으면_404와_PIN_NOT_FOUND를_반환한다() throws Exception {
        given(pinDetailService.getPinDetail(eq(PIN_ID), eq(MEMBER_ID)))
                .willThrow(new CustomException(ErrorCode.PIN_NOT_FOUND));

        mockMvc.perform(get("/api/v1/pins/{pinId}", PIN_ID))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.statusCode").value(404))
                .andExpect(jsonPath("$.error.code").value("PIN_NOT_FOUND"))
                .andExpect(jsonPath("$.message").value("조회할 수 있는 핀이 없습니다."));
    }

    @Test
    void 상세_조회_내부_실패면_500과_PIN_DETAIL_FETCH_FAILED를_반환한다() throws Exception {
        given(pinDetailService.getPinDetail(eq(PIN_ID), eq(MEMBER_ID)))
                .willThrow(new CustomException(ErrorCode.PIN_DETAIL_FETCH_FAILED));

        mockMvc.perform(get("/api/v1/pins/{pinId}", PIN_ID))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.statusCode").value(500))
                .andExpect(jsonPath("$.error.code").value("PIN_DETAIL_FETCH_FAILED"))
                .andExpect(jsonPath("$.message").value("영상 핀 상세 조회 중 오류가 발생했습니다."));
    }

    @Test
    void 상세_조회_미디어_URL_발급_실패면_503과_MEDIA_URL_ISSUE_FAILED를_반환한다() throws Exception {
        given(pinDetailService.getPinDetail(eq(PIN_ID), eq(MEMBER_ID)))
                .willThrow(new CustomException(ErrorCode.MEDIA_URL_ISSUE_FAILED));

        mockMvc.perform(get("/api/v1/pins/{pinId}", PIN_ID))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.statusCode").value(503))
                .andExpect(jsonPath("$.error.code").value("MEDIA_URL_ISSUE_FAILED"))
                .andExpect(jsonPath("$.message").value("영상 미디어 URL 발급에 실패했습니다."));
    }

    // ---------- 핀 수정(PATCH) ----------

    @Test
    void 일반_정보만_수정하면_200과_updatedFields를_반환한다() throws Exception {
        java.util.UUID pinId = java.util.UUID.fromString(PIN_ID);
        given(pinUpdateService.update(eq(MEMBER_ID), eq(PIN_ID), any()))
                .willReturn(PinUpdateResponse.generalOnly(
                        pinId, VideoStatus.ACTIVE, java.util.List.of("detailLocation", "memo")));

        mockMvc.perform(patch("/api/v1/pins/{pinId}", PIN_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"memo\":\"새 메모\",\"detailLocation\":\"2층 창가\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.statusCode").value(200))
                .andExpect(jsonPath("$.message").value("영상 핀이 수정되었습니다."))
                .andExpect(jsonPath("$.data.pinId").value(PIN_ID))
                .andExpect(jsonPath("$.data.videoStatus").value("ACTIVE"))
                .andExpect(jsonPath("$.data.updatedFields[0]").value("detailLocation"))
                .andExpect(jsonPath("$.data.updatedFields[1]").value("memo"))
                // 일반 정보만 수정하면 교체 관련 필드는 응답에서 생략된다.
                .andExpect(jsonPath("$.data.videoReplacementStatus").doesNotExist())
                .andExpect(jsonPath("$.data.pendingFields").doesNotExist());

        verify(pinUpdateService).update(eq(MEMBER_ID), eq(PIN_ID), any());
    }

    @Test
    void 영상_교체가_포함되면_202와_교체_상태를_반환한다() throws Exception {
        java.util.UUID pinId = java.util.UUID.fromString(PIN_ID);
        given(pinUpdateService.update(eq(MEMBER_ID), eq(PIN_ID), any()))
                .willReturn(PinUpdateResponse.withReplacement(
                        pinId, VideoStatus.ACTIVE, java.util.List.of("detailLocation"),
                        java.util.List.of("originalVideoKey")));

        mockMvc.perform(patch("/api/v1/pins/{pinId}", PIN_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"originalVideoKey\":\"pins/original/42/bbb.mp4\"}"))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.statusCode").value(202))
                .andExpect(jsonPath("$.message").value("영상 교체 요청이 접수되었습니다."))
                .andExpect(jsonPath("$.data.videoStatus").value("ACTIVE"))
                .andExpect(jsonPath("$.data.videoReplacementStatus").value("PENDING"))
                .andExpect(jsonPath("$.data.updatedFields[0]").value("detailLocation"))
                .andExpect(jsonPath("$.data.pendingFields[0]").value("originalVideoKey"));
    }

    @Test
    void 영상만_교체하면_updatedFields는_빈_배열이다() throws Exception {
        java.util.UUID pinId = java.util.UUID.fromString(PIN_ID);
        given(pinUpdateService.update(eq(MEMBER_ID), eq(PIN_ID), any()))
                .willReturn(PinUpdateResponse.withReplacement(
                        pinId, VideoStatus.ACTIVE, java.util.List.of(),
                        java.util.List.of("originalVideoKey")));

        mockMvc.perform(patch("/api/v1/pins/{pinId}", PIN_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"originalVideoKey\":\"pins/original/42/bbb.mp4\"}"))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.data.updatedFields").isArray())
                .andExpect(jsonPath("$.data.updatedFields").isEmpty());
    }

    @Test
    void 진행_중_교체_작업이면_409_PIN_UPDATE_IN_PROGRESS를_반환한다() throws Exception {
        given(pinUpdateService.update(eq(MEMBER_ID), eq(PIN_ID), any()))
                .willThrow(new CustomException(ErrorCode.PIN_UPDATE_IN_PROGRESS));

        mockMvc.perform(patch("/api/v1/pins/{pinId}", PIN_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"originalVideoKey\":\"pins/original/42/bbb.mp4\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.statusCode").value(409))
                .andExpect(jsonPath("$.error.code").value("PIN_UPDATE_IN_PROGRESS"));
    }

    @Test
    void 영상_객체_확인_실패면_422_VIDEO_NOT_ACCESSIBLE를_반환한다() throws Exception {
        given(pinUpdateService.update(eq(MEMBER_ID), eq(PIN_ID), any()))
                .willThrow(new CustomException(ErrorCode.VIDEO_NOT_ACCESSIBLE));

        mockMvc.perform(patch("/api/v1/pins/{pinId}", PIN_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"originalVideoKey\":\"pins/original/42/bbb.mp4\"}"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.statusCode").value(422))
                .andExpect(jsonPath("$.error.code").value("VIDEO_NOT_ACCESSIBLE"));
    }

    @Test
    void 수정_대상_핀이_없으면_404_PIN_NOT_FOUND를_반환한다() throws Exception {
        given(pinUpdateService.update(eq(MEMBER_ID), eq(PIN_ID), any()))
                .willThrow(new CustomException(ErrorCode.PIN_NOT_FOUND));

        mockMvc.perform(patch("/api/v1/pins/{pinId}", PIN_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"memo\":\"m\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.statusCode").value(404))
                .andExpect(jsonPath("$.error.code").value("PIN_NOT_FOUND"));
    }

    // ---------- 핀 삭제(DELETE) ----------

    @Test
    void 삭제_성공시_200과_DELETED_상태_종료된_채팅방ID_삭제시각을_반환한다() throws Exception {
        java.util.UUID pinId = java.util.UUID.fromString(PIN_ID);
        given(pinDeleteService.delete(MEMBER_ID, PIN_ID))
                .willReturn(PinDeleteResponse.of(
                        pinId, java.util.List.of(1L), Instant.parse("2026-07-22T04:00:00Z")));

        mockMvc.perform(delete("/api/v1/pins/{pinId}", PIN_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.statusCode").value(200))
                .andExpect(jsonPath("$.message").value("영상 핀이 삭제되었습니다."))
                .andExpect(jsonPath("$.data.pinId").value(PIN_ID))
                .andExpect(jsonPath("$.data.status").value("DELETED"))
                .andExpect(jsonPath("$.data.closedChatRoomIds[0]").value(1))
                .andExpect(jsonPath("$.data.deletedAt").value("2026-07-22T04:00:00Z"));

        verify(pinDeleteService).delete(MEMBER_ID, PIN_ID);
    }

    @Test
    void 재삭제_요청이면_200과_빈_종료_채팅방ID를_반환한다() throws Exception {
        java.util.UUID pinId = java.util.UUID.fromString(PIN_ID);
        given(pinDeleteService.delete(MEMBER_ID, PIN_ID))
                .willReturn(PinDeleteResponse.of(
                        pinId, java.util.List.of(), Instant.parse("2026-07-22T04:00:00Z")));

        mockMvc.perform(delete("/api/v1/pins/{pinId}", PIN_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("DELETED"))
                .andExpect(jsonPath("$.data.closedChatRoomIds").isArray())
                .andExpect(jsonPath("$.data.closedChatRoomIds").isEmpty());
    }

    @Test
    void 삭제_잘못된_pinId_형식이면_400_INVALID_PIN_ID를_반환한다() throws Exception {
        given(pinDeleteService.delete(eq(MEMBER_ID), eq("not-a-uuid")))
                .willThrow(new CustomException(ErrorCode.INVALID_PIN_ID));

        mockMvc.perform(delete("/api/v1/pins/{pinId}", "not-a-uuid"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.statusCode").value(400))
                .andExpect(jsonPath("$.error.code").value("INVALID_PIN_ID"));
    }

    @Test
    void 삭제_작성자가_아니면_403_PIN_DELETE_FORBIDDEN을_반환한다() throws Exception {
        given(pinDeleteService.delete(MEMBER_ID, PIN_ID))
                .willThrow(new CustomException(ErrorCode.PIN_DELETE_FORBIDDEN));

        mockMvc.perform(delete("/api/v1/pins/{pinId}", PIN_ID))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.statusCode").value(403))
                .andExpect(jsonPath("$.error.code").value("PIN_DELETE_FORBIDDEN"))
                .andExpect(jsonPath("$.message").value("핀을 삭제할 권한이 없습니다."));
    }

    @Test
    void 삭제_대상_핀이_없으면_404_PIN_NOT_FOUND를_반환한다() throws Exception {
        given(pinDeleteService.delete(MEMBER_ID, PIN_ID))
                .willThrow(new CustomException(ErrorCode.PIN_NOT_FOUND));

        mockMvc.perform(delete("/api/v1/pins/{pinId}", PIN_ID))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.statusCode").value(404))
                .andExpect(jsonPath("$.error.code").value("PIN_NOT_FOUND"));
    }

    @Test
    void 삭제_처리_실패면_500_PIN_DELETE_FAILED를_반환한다() throws Exception {
        given(pinDeleteService.delete(MEMBER_ID, PIN_ID))
                .willThrow(new CustomException(ErrorCode.PIN_DELETE_FAILED));

        mockMvc.perform(delete("/api/v1/pins/{pinId}", PIN_ID))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.statusCode").value(500))
                .andExpect(jsonPath("$.error.code").value("PIN_DELETE_FAILED"))
                .andExpect(jsonPath("$.message").value("영상 핀 삭제 중 오류가 발생했습니다."));
    }
}
