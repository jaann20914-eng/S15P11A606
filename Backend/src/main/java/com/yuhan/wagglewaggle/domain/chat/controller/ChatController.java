package com.yuhan.wagglewaggle.domain.chat.controller;

import com.yuhan.wagglewaggle.domain.chat.dto.ChatRequestCreateRequest;
import com.yuhan.wagglewaggle.domain.chat.dto.ChatRequestCreateResponse;
import com.yuhan.wagglewaggle.domain.chat.service.ChatRequestService;
import com.yuhan.wagglewaggle.global.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/chat")
public class ChatController {

    private final ChatRequestService chatRequestService;

    /**
     * 채팅 요청을 생성한다. 구매 완료한 타인 소유의 활성 핀에 대해 PENDING 채팅방을 만든다.
     * 성공 시 201과 생성된 roomId·요청 pinId를 반환한다.
     */
    @PostMapping("/request")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ChatRequestCreateResponse> request(
            @AuthenticationPrincipal Long memberId,
            @RequestBody(required = false) ChatRequestCreateRequest request
    ) {
        ChatRequestCreateResponse data = chatRequestService.request(memberId, request);
        return ApiResponse.success(HttpStatus.CREATED.value(), "채팅 요청이 전송되었습니다.", data);
    }
}
