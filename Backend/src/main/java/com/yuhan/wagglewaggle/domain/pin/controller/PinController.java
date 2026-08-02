package com.yuhan.wagglewaggle.domain.pin.controller;

import com.yuhan.wagglewaggle.domain.pin.dto.PinCreateRequest;
import com.yuhan.wagglewaggle.domain.pin.dto.PinCreateResponse;
import com.yuhan.wagglewaggle.domain.pin.dto.PinDetailResponse;
import com.yuhan.wagglewaggle.domain.pin.dto.PinUploadUrlRequest;
import com.yuhan.wagglewaggle.domain.pin.dto.PinVideoStatusResponse;
import com.yuhan.wagglewaggle.domain.pin.dto.PinVideoStatusView;
import com.yuhan.wagglewaggle.domain.pin.dto.PinVideoUploadUrlResponse;
import com.yuhan.wagglewaggle.domain.pin.service.PinCreateService;
import com.yuhan.wagglewaggle.domain.pin.service.PinDetailService;
import com.yuhan.wagglewaggle.domain.pin.service.PinVideoStatusQueryService;
import com.yuhan.wagglewaggle.domain.pin.service.PinVideoUploadService;
import com.yuhan.wagglewaggle.global.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/pins")
public class PinController {

    private final PinVideoUploadService pinVideoUploadService;
    private final PinCreateService pinCreateService;
    private final PinVideoStatusQueryService pinVideoStatusQueryService;
    private final PinDetailService pinDetailService;

    /**
     * 인증 사용자의 원본 영상 업로드 정보(Presigned PUT URL·객체 키·만료 시각)를 발급한다.
     * 요청 검증은 서비스에서 수행하므로 바디를 선택 파라미터로 받아 정확한 오류 코드를 반환한다.
     */
    @PostMapping("/upload-url")
    public ApiResponse<PinVideoUploadUrlResponse> issueUploadUrl(
            @AuthenticationPrincipal Long memberId,
            @RequestBody(required = false) PinUploadUrlRequest request
    ) {
        PinVideoUploadUrlResponse data =
                pinVideoUploadService.issueOriginalVideoUploadUrl(memberId, request);

        return ApiResponse.success(HttpStatus.OK.value(), "영상 업로드 정보가 발급되었습니다.", data);
    }

    /**
     * 인증 사용자의 핀 등록 요청을 처리한다.
     * 검증 후 Pin·PinTag·AiBlurJob을 한 트랜잭션으로 저장하고, 접수 결과를 202로 반환한다.
     */
    @PostMapping
    @ResponseStatus(HttpStatus.ACCEPTED)
    public ApiResponse<PinCreateResponse> create(
            @AuthenticationPrincipal Long memberId,
            @RequestBody(required = false) PinCreateRequest request
    ) {
        PinCreateResponse data = pinCreateService.create(memberId, request);

        return ApiResponse.success(HttpStatus.ACCEPTED.value(), "영상 핀 등록 요청이 접수되었습니다.", data);
    }

    /**
     * 인증 사용자가 게시한 핀의 AI 영상 처리 상태를 조회한다.
     * 상태별 안내 문구를 message로, 상태·영상 URL을 data로 반환한다.
     * ACTIVE이며 만료되지 않은 경우에만 블러 영상·썸네일 Presigned GET URL을 함께 발급한다.
     */
    @GetMapping("/{pinId}/status")
    public ApiResponse<PinVideoStatusResponse> getVideoStatus(
            @AuthenticationPrincipal Long memberId,
            @PathVariable UUID pinId
    ) {
        PinVideoStatusView view = pinVideoStatusQueryService.getVideoStatus(memberId, pinId);

        return ApiResponse.success(HttpStatus.OK.value(), view.message(), view.data());
    }

    /**
     * 인증 사용자 기준으로 영상 핀 상세를 조회한다.
     * 작성자·장소·혼잡 정보와 태그, 사용자별 영상 접근 수준·평가 여부·채팅 상태를 반환하며,
     * 블러 영상·썸네일은 요청 시점마다 Presigned GET URL로 발급한다.
     * pinId 형식 검증(INVALID_PIN_ID)을 위해 경로 변수를 문자열로 받아 서비스에서 파싱한다.
     */
    @GetMapping("/{pinId}")
    public ApiResponse<PinDetailResponse> getPinDetail(
            @AuthenticationPrincipal Long memberId,
            @PathVariable String pinId
    ) {
        PinDetailResponse data = pinDetailService.getPinDetail(pinId, memberId);

        return ApiResponse.success(HttpStatus.OK.value(), "영상 핀 상세 조회가 완료되었습니다.", data);
    }
}
