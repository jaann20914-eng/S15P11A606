package com.yuhan.wagglewaggle.domain.user.controller;

import com.yuhan.wagglewaggle.domain.user.dto.NicknameAvailabilityResponse;
import com.yuhan.wagglewaggle.domain.user.service.UserService;
import com.yuhan.wagglewaggle.global.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    private final UserService userService;

    /**
     * 닉네임 중복 확인. 인증 없이 호출 가능한 공개 API.
     * 파라미터 누락·형식 위반은 모두 서비스 계층에서 INVALID_NICKNAME(400)으로 처리한다.
     */
    @GetMapping("/nickname-availability")
    public ApiResponse<NicknameAvailabilityResponse> checkNicknameAvailability(
            @RequestParam(required = false) String nickname
    ) {
        NicknameAvailabilityResponse result = userService.checkNicknameAvailability(nickname);

        return ApiResponse.success(
                HttpStatus.OK.value(),
                "닉네임 사용 가능 여부 조회가 완료되었습니다.",
                result);
    }
}
