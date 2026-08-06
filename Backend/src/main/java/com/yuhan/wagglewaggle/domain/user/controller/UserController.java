package com.yuhan.wagglewaggle.domain.user.controller;

import com.yuhan.wagglewaggle.domain.category.dto.CategoryPreferenceResponse;
import com.yuhan.wagglewaggle.domain.category.service.CategoryPreferenceService;
import com.yuhan.wagglewaggle.domain.credit.dto.CreditTransactionListResponse;
import com.yuhan.wagglewaggle.domain.credit.service.CreditTransactionService;
import com.yuhan.wagglewaggle.domain.pin.dto.TodayPinListResponse;
import com.yuhan.wagglewaggle.domain.pin.service.TodayPinService;
import com.yuhan.wagglewaggle.domain.user.dto.NicknameAvailabilityResponse;
import com.yuhan.wagglewaggle.domain.user.dto.NicknameUpdateRequest;
import com.yuhan.wagglewaggle.domain.user.dto.NicknameUpdateResponse;
import com.yuhan.wagglewaggle.domain.user.dto.ProfileUpdateRequest;
import com.yuhan.wagglewaggle.domain.user.dto.ProfileUpdateResponse;
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
    private final TodayPinService todayPinService;
    private final CreditTransactionService creditTransactionService;
    private final CategoryPreferenceService categoryPreferenceService;

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

    /**
     * 현재 인증 사용자가 선택한 관심 카테고리 목록을 조회한다(인증 필요).
     * 설정 화면에서 기존 선택값을 미리 선택된 상태로 표시하는 데 사용한다.
     * 사용자 식별 정보는 액세스 토큰에서 가져온다.
     */
    @GetMapping("/me/categories")
    public ApiResponse<CategoryPreferenceResponse> getMyCategories(
            @AuthenticationPrincipal Long memberId
    ) {
        CategoryPreferenceResponse data = categoryPreferenceService.getMyCategories(memberId);

        return ApiResponse.success(
                HttpStatus.OK.value(),
                "관심 카테고리 조회가 완료되었습니다.",
                data);
    }

    /**
     * 마이페이지 '변경 저장': 현재 인증 사용자의 닉네임과 관심 카테고리를 한 번에 수정한다(인증 필요).
     * 닉네임 수정과 카테고리 수정은 하나의 트랜잭션으로 처리되어 하나라도 실패하면 전체가 반영되지 않는다.
     * 각 항목 검증은 Front의 사전 확인과 무관하게 서비스 계층에서 다시 수행하며, 사용자 식별 정보는 액세스 토큰에서 가져온다.
     */
    @PatchMapping("/me/profile")
    public ApiResponse<ProfileUpdateResponse> updateMyProfile(
            @AuthenticationPrincipal Long memberId,
            @RequestBody(required = false) ProfileUpdateRequest request
    ) {
        ProfileUpdateResponse data = userService.updateProfile(memberId, request);

        return ApiResponse.success(
                HttpStatus.OK.value(),
                "프로필이 수정되었습니다.",
                data);
    }

    /**
     * 현재 인증 사용자가 오늘 등록한 영상 핀 목록을 커서 페이지네이션으로 조회한다(인증 필요).
     * cursor·limit 형식·범위 위반은 서비스 계층에서 INVALID_PAGINATION(400)으로 처리한다.
     * 사용자 식별 정보는 액세스 토큰에서 가져온다.
     */
    @GetMapping("/me/pins/today")
    public ApiResponse<TodayPinListResponse> getMyTodayPins(
            @AuthenticationPrincipal Long memberId,
            @RequestParam(required = false) String cursor,
            @RequestParam(required = false) String limit
    ) {
        TodayPinListResponse data = todayPinService.getMyTodayPins(memberId, cursor, limit);

        return ApiResponse.success(
                HttpStatus.OK.value(),
                "오늘 등록한 영상 핀 목록 조회가 완료되었습니다.",
                data);
    }

    /**
     * 현재 인증 사용자의 크레딧 잔액과 거래 내역을 커서 페이지네이션으로 조회한다(인증 필요).
     * type·period 필터 위반은 서비스 계층에서 INVALID_CREDIT_FILTER(400),
     * cursor·limit 형식·범위 위반은 INVALID_PAGINATION(400)으로 처리한다.
     * 사용자 식별 정보는 액세스 토큰에서 가져온다.
     */
    @GetMapping("/me/credits/transactions")
    public ApiResponse<CreditTransactionListResponse> getMyCreditTransactions(
            @AuthenticationPrincipal Long memberId,
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String period,
            @RequestParam(required = false) String cursor,
            @RequestParam(required = false) String limit
    ) {
        CreditTransactionListResponse data =
                creditTransactionService.getMyCreditTransactions(memberId, type, period, cursor, limit);

        return ApiResponse.success(
                HttpStatus.OK.value(),
                "크레딧 내역 조회가 완료되었습니다.",
                data);
    }
}
