package com.yuhan.wagglewaggle.domain.user.controller;

import com.yuhan.wagglewaggle.domain.user.dto.NicknameAvailabilityResponse;
import com.yuhan.wagglewaggle.domain.user.dto.NicknameUpdateRequest;
import com.yuhan.wagglewaggle.domain.user.dto.NicknameUpdateResponse;
import com.yuhan.wagglewaggle.domain.user.dto.ServiceAccess;
import com.yuhan.wagglewaggle.domain.user.dto.UserProfileResponse;
import com.yuhan.wagglewaggle.domain.user.dto.UserProfileResponse.ActivitySummary;
import com.yuhan.wagglewaggle.domain.user.dto.UserProfileResponse.DailyActivity;
import com.yuhan.wagglewaggle.domain.user.dto.UserProfileResponse.MonthlyActivity;
import com.yuhan.wagglewaggle.domain.pin.dto.TodayPinItem;
import com.yuhan.wagglewaggle.domain.pin.dto.TodayPinListResponse;
import com.yuhan.wagglewaggle.domain.pin.dto.TodayPinStatus;
import com.yuhan.wagglewaggle.domain.pin.service.TodayPinService;
import com.yuhan.wagglewaggle.domain.user.service.UserProfileService;
import com.yuhan.wagglewaggle.domain.user.service.UserService;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import com.yuhan.wagglewaggle.global.exception.GlobalExceptionHandler;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mockito;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.nullValue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class UserControllerTest {

    private static final Long MEMBER_ID = 42L;

    private UserService userService;
    private UserProfileService userProfileService;
    private TodayPinService todayPinService;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        userService = Mockito.mock(UserService.class);
        userProfileService = Mockito.mock(UserProfileService.class);
        todayPinService = Mockito.mock(TodayPinService.class);
        mockMvc = MockMvcBuilders.standaloneSetup(
                        new UserController(userService, userProfileService, todayPinService))
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
    @DisplayName("닉네임 사용 가능 시 200과 응답 형식을 반환한다")
    void 사용가능_200() throws Exception {
        given(userService.checkNicknameAvailability(any()))
                .willReturn(new NicknameAvailabilityResponse("와글러", true));

        mockMvc.perform(get("/api/v1/users/nickname-availability").param("nickname", "와글러"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.statusCode").value(200))
                .andExpect(jsonPath("$.message").value("닉네임 사용 가능 여부 조회가 완료되었습니다."))
                .andExpect(jsonPath("$.data.nickname").value("와글러"))
                .andExpect(jsonPath("$.data.available").value(true));
    }

    @Test
    @DisplayName("형식 위반 시 400과 INVALID_NICKNAME 코드를 반환한다")
    void 형식위반_400() throws Exception {
        given(userService.checkNicknameAvailability(any()))
                .willThrow(new CustomException(ErrorCode.INVALID_NICKNAME));

        mockMvc.perform(get("/api/v1/users/nickname-availability").param("nickname", "a"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.statusCode").value(400))
                .andExpect(jsonPath("$.error.code").value("INVALID_NICKNAME"));
    }

    @Test
    @DisplayName("내 프로필 조회 성공 시 200과 응답 형식을 반환한다")
    void 내프로필_200() throws Exception {
        given(userProfileService.getMyProfile(eq(MEMBER_ID), eq("2026"), eq("7")))
                .willReturn(sampleProfile());

        mockMvc.perform(get("/api/v1/users/me").param("year", "2026").param("month", "7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.statusCode").value(200))
                .andExpect(jsonPath("$.message").value("내 프로필 및 활동 요약 조회가 완료되었습니다."))
                .andExpect(jsonPath("$.data.userId").value(42))
                .andExpect(jsonPath("$.data.nickname").value("와글러"))
                .andExpect(jsonPath("$.data.viewReliability").value(92.5))
                .andExpect(jsonPath("$.data.creditBalance").value(120))
                .andExpect(jsonPath("$.data.todayVideoPinCount").value(2))
                .andExpect(jsonPath("$.data.serviceAccess").value("ALLOWED"))
                .andExpect(jsonPath("$.data.monthlyActivity.year").value(2026))
                .andExpect(jsonPath("$.data.monthlyActivity.month").value(7))
                .andExpect(jsonPath("$.data.monthlyActivity.days[0].date").value("2026-07-01"))
                .andExpect(jsonPath("$.data.monthlyActivity.summary.createdVideoPinCount").value(14));
    }

    @Test
    @DisplayName("연월 없이 호출하면 서비스에 null을 전달한다")
    void 내프로필_연월생략() throws Exception {
        given(userProfileService.getMyProfile(eq(MEMBER_ID), eq(null), eq(null)))
                .willReturn(sampleProfile());

        mockMvc.perform(get("/api/v1/users/me"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.userId").value(42));
    }

    @Test
    @DisplayName("연월이 올바르지 않으면 400과 INVALID_YEAR_MONTH 코드를 반환한다")
    void 내프로필_연월오류_400() throws Exception {
        given(userProfileService.getMyProfile(eq(MEMBER_ID), any(), any()))
                .willThrow(new CustomException(ErrorCode.INVALID_YEAR_MONTH));

        mockMvc.perform(get("/api/v1/users/me").param("year", "2026").param("month", "13"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.statusCode").value(400))
                .andExpect(jsonPath("$.error.code").value("INVALID_YEAR_MONTH"));
    }

    @Test
    @DisplayName("사용자를 찾을 수 없으면 404와 USER_NOT_FOUND 코드를 반환한다")
    void 내프로필_사용자없음_404() throws Exception {
        given(userProfileService.getMyProfile(eq(MEMBER_ID), any(), any()))
                .willThrow(new CustomException(ErrorCode.USER_NOT_FOUND));

        mockMvc.perform(get("/api/v1/users/me"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.statusCode").value(404))
                .andExpect(jsonPath("$.error.code").value("USER_NOT_FOUND"));
    }

    @Test
    @DisplayName("닉네임 수정 성공 시 200과 변경된 닉네임을 반환하고 요청 본문을 서비스에 전달한다")
    void 닉네임수정_200() throws Exception {
        given(userService.updateNickname(eq(MEMBER_ID), any()))
                .willReturn(new NicknameUpdateResponse("새와글러"));

        mockMvc.perform(patch("/api/v1/users/me/nickname")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nickname\":\"새와글러\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.statusCode").value(200))
                .andExpect(jsonPath("$.message").value("닉네임이 수정되었습니다."))
                .andExpect(jsonPath("$.data.nickname").value("새와글러"));

        // 요청 본문이 NicknameUpdateRequest로 바인딩되어 서비스에 그대로 전달되는지 검증한다.
        ArgumentCaptor<NicknameUpdateRequest> captor = ArgumentCaptor.forClass(NicknameUpdateRequest.class);
        verify(userService).updateNickname(eq(MEMBER_ID), captor.capture());
        assertThat(captor.getValue().nickname()).isEqualTo("새와글러");
    }

    @Test
    @DisplayName("형식 위반 시 400과 INVALID_NICKNAME 코드를 반환한다")
    void 닉네임수정_형식위반_400() throws Exception {
        given(userService.updateNickname(eq(MEMBER_ID), any()))
                .willThrow(new CustomException(ErrorCode.INVALID_NICKNAME));

        mockMvc.perform(patch("/api/v1/users/me/nickname")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nickname\":\"a\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.statusCode").value(400))
                .andExpect(jsonPath("$.error.code").value("INVALID_NICKNAME"));
    }

    @Test
    @DisplayName("이미 사용 중인 닉네임이면 409와 NICKNAME_ALREADY_EXISTS 코드를 반환한다")
    void 닉네임수정_중복_409() throws Exception {
        given(userService.updateNickname(eq(MEMBER_ID), any()))
                .willThrow(new CustomException(ErrorCode.NICKNAME_ALREADY_EXISTS));

        mockMvc.perform(patch("/api/v1/users/me/nickname")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nickname\":\"중복와글러\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.statusCode").value(409))
                .andExpect(jsonPath("$.error.code").value("NICKNAME_ALREADY_EXISTS"));
    }

    @Test
    @DisplayName("사용자를 찾을 수 없으면 404와 USER_NOT_FOUND 코드를 반환한다")
    void 닉네임수정_사용자없음_404() throws Exception {
        given(userService.updateNickname(eq(MEMBER_ID), any()))
                .willThrow(new CustomException(ErrorCode.USER_NOT_FOUND));

        mockMvc.perform(patch("/api/v1/users/me/nickname")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nickname\":\"새와글러\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.statusCode").value(404))
                .andExpect(jsonPath("$.error.code").value("USER_NOT_FOUND"));
    }

    @Test
    @DisplayName("오늘 등록 핀 목록 조회 성공 시 200과 응답 형식을 반환하고 cursor·limit을 서비스에 전달한다")
    void 오늘핀_200() throws Exception {
        UUID pinId = UUID.fromString("15ab5bf8-3395-4ab8-9904-c49e20a01234");
        TodayPinItem item = new TodayPinItem(
                pinId, 1L, "카페 A", "서울 광진구 동일로60길 47 1층 (군자동)",
                TodayPinStatus.PROCESSING, Instant.parse("2026-08-03T01:30:00Z"));
        given(todayPinService.getMyTodayPins(eq(MEMBER_ID), eq("c123"), eq("10")))
                .willReturn(new TodayPinListResponse(List.of(item), null));

        mockMvc.perform(get("/api/v1/users/me/pins/today")
                        .param("cursor", "c123")
                        .param("limit", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.statusCode").value(200))
                .andExpect(jsonPath("$.message").value("오늘 등록한 영상 핀 목록 조회가 완료되었습니다."))
                .andExpect(jsonPath("$.data.items[0].pinId").value("15ab5bf8-3395-4ab8-9904-c49e20a01234"))
                .andExpect(jsonPath("$.data.items[0].placeId").value(1))
                .andExpect(jsonPath("$.data.items[0].placeName").value("카페 A"))
                .andExpect(jsonPath("$.data.items[0].placeAddress").value("서울 광진구 동일로60길 47 1층 (군자동)"))
                .andExpect(jsonPath("$.data.items[0].status").value("PROCESSING"))
                .andExpect(jsonPath("$.data.items[0].createdAt").value("2026-08-03T01:30:00Z"))
                .andExpect(jsonPath("$.data.nextCursor").value(nullValue()));

        verify(todayPinService).getMyTodayPins(MEMBER_ID, "c123", "10");
    }

    @Test
    @DisplayName("결과가 없으면 200과 빈 배열을 반환한다")
    void 오늘핀_빈목록_200() throws Exception {
        given(todayPinService.getMyTodayPins(eq(MEMBER_ID), any(), any()))
                .willReturn(new TodayPinListResponse(List.of(), null));

        mockMvc.perform(get("/api/v1/users/me/pins/today"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items").isArray())
                .andExpect(jsonPath("$.data.items").isEmpty())
                .andExpect(jsonPath("$.data.nextCursor").value(nullValue()));
    }

    @Test
    @DisplayName("페이지 조건이 올바르지 않으면 400과 INVALID_PAGINATION 코드를 반환한다")
    void 오늘핀_페이지조건오류_400() throws Exception {
        given(todayPinService.getMyTodayPins(eq(MEMBER_ID), any(), any()))
                .willThrow(new CustomException(ErrorCode.INVALID_PAGINATION));

        mockMvc.perform(get("/api/v1/users/me/pins/today").param("limit", "0"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.statusCode").value(400))
                .andExpect(jsonPath("$.error.code").value("INVALID_PAGINATION"));
    }

    @Test
    @DisplayName("사용자를 찾을 수 없으면 404와 USER_NOT_FOUND 코드를 반환한다")
    void 오늘핀_사용자없음_404() throws Exception {
        given(todayPinService.getMyTodayPins(eq(MEMBER_ID), any(), any()))
                .willThrow(new CustomException(ErrorCode.USER_NOT_FOUND));

        mockMvc.perform(get("/api/v1/users/me/pins/today"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.statusCode").value(404))
                .andExpect(jsonPath("$.error.code").value("USER_NOT_FOUND"));
    }

    private UserProfileResponse sampleProfile() {
        return new UserProfileResponse(
                42L, "와글러", new BigDecimal("92.5"), 120, 2, ServiceAccess.ALLOWED,
                new MonthlyActivity(2026, 7,
                        List.of(new DailyActivity(LocalDate.of(2026, 7, 1), 2)),
                        new ActivitySummary(14, 220, 97)));
    }
}
