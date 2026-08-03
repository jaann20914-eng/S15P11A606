package com.yuhan.wagglewaggle.domain.user.controller;

import com.yuhan.wagglewaggle.domain.user.dto.NicknameAvailabilityResponse;
import com.yuhan.wagglewaggle.domain.user.dto.NicknameUpdateRequest;
import com.yuhan.wagglewaggle.domain.user.dto.NicknameUpdateResponse;
import com.yuhan.wagglewaggle.domain.user.dto.UserProfileResponse;
import com.yuhan.wagglewaggle.domain.user.service.UserProfileService;
import com.yuhan.wagglewaggle.domain.user.service.UserService;
import com.yuhan.wagglewaggle.global.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RequiredArgsConstructor
@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    private final UserService userService;
    private final UserProfileService userProfileService;

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

    /**
     * 현재 인증 사용자의 프로필·활동 요약을 조회한다(인증 필요).
     * year·month는 함께 전달해야 하며, 생략 시 현재 서비스 연월을 조회한다.
     * 형식 위반(INVALID_YEAR_MONTH) 구분을 위해 연월을 문자열로 받아 서비스에서 파싱한다.
     * 사용자 식별 정보는 액세스 토큰에서 가져온다.
     */
    @GetMapping("/me")
    public ApiResponse<UserProfileResponse> getMyProfile(
            @AuthenticationPrincipal Long memberId,
            @RequestParam(required = false) String year,
            @RequestParam(required = false) String month
    ) {
        UserProfileResponse data = userProfileService.getMyProfile(memberId, year, month);

        return ApiResponse.success(
                HttpStatus.OK.value(),
                "내 프로필 및 활동 요약 조회가 완료되었습니다.",
                data);
    }

    /**
     * 현재 인증 사용자의 닉네임을 수정한다(인증 필요).
     * 형식·길이·금칙어·중복 등 유효성은 Front의 사전 확인 여부와 무관하게 서비스 계층에서 다시 검증한다.
     * 사용자 식별 정보는 액세스 토큰에서 가져온다.
     */
    @PatchMapping("/me/nickname")
    public ApiResponse<NicknameUpdateResponse> updateNickname(
            @AuthenticationPrincipal Long memberId,
            @RequestBody(required = false) NicknameUpdateRequest request
    ) {
        NicknameUpdateResponse data = userService.updateNickname(memberId, request);

        return ApiResponse.success(
                HttpStatus.OK.value(),
                "닉네임이 수정되었습니다.",
                data);
    }
}
