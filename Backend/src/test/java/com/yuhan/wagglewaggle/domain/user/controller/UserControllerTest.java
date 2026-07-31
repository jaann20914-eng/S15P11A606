package com.yuhan.wagglewaggle.domain.user.controller;

import com.yuhan.wagglewaggle.domain.user.dto.NicknameAvailabilityResponse;
import com.yuhan.wagglewaggle.domain.user.service.UserService;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import com.yuhan.wagglewaggle.global.exception.GlobalExceptionHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class UserControllerTest {

    private UserService userService;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        userService = Mockito.mock(UserService.class);
        mockMvc = MockMvcBuilders.standaloneSetup(new UserController(userService))
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
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
}
