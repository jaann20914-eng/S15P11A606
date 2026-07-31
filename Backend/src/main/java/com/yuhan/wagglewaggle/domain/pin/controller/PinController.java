package com.yuhan.wagglewaggle.domain.pin.controller;

import com.yuhan.wagglewaggle.domain.pin.dto.PinUploadUrlRequest;
import com.yuhan.wagglewaggle.domain.pin.dto.PinVideoUploadUrlResponse;
import com.yuhan.wagglewaggle.domain.pin.service.PinVideoUploadService;
import com.yuhan.wagglewaggle.global.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/pins")
public class PinController {

    private final PinVideoUploadService pinVideoUploadService;

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
}
