package com.yuhan.wagglewaggle.domain.chat.controller;

import com.yuhan.wagglewaggle.domain.chat.dto.ChatPatternResultRequest;
import com.yuhan.wagglewaggle.domain.chat.service.ChatPatternResultService;
import com.yuhan.wagglewaggle.global.response.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * AI Worker의 패턴 분석 결과 콜백 수신 컨트롤러(내부 전용).
 * 인증은 X-Internal-Secret 헤더로 InternalSecretAuthFilter가 담당한다(JWT 불필요).
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/internal/chat")
public class ChatPatternResultController {

    private final ChatPatternResultService chatPatternResultService;

    @PostMapping("/pattern-result")
    @ResponseStatus(HttpStatus.OK)
    public ApiResponse<Void> applyPatternResult(@RequestBody @Valid ChatPatternResultRequest request) {
        chatPatternResultService.apply(request);
        return ApiResponse.success(HttpStatus.OK.value(), "패턴 분석 결과를 반영했습니다.");
    }
}
