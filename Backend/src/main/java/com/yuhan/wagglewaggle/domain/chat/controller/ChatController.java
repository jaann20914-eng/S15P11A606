package com.yuhan.wagglewaggle.domain.chat.controller;

import com.yuhan.wagglewaggle.domain.chat.dto.ChatDecisionRequest;
import com.yuhan.wagglewaggle.domain.chat.dto.ChatDecisionResponse;
import com.yuhan.wagglewaggle.domain.chat.dto.ChatMessagesHistoryResponse;
import com.yuhan.wagglewaggle.domain.chat.dto.ChatReadRequest;
import com.yuhan.wagglewaggle.domain.chat.dto.ChatReadResponse;
import com.yuhan.wagglewaggle.domain.chat.dto.ChatRequestCreateRequest;
import com.yuhan.wagglewaggle.domain.chat.dto.ChatRequestCreateResponse;
import com.yuhan.wagglewaggle.domain.chat.service.ChatDecisionService;
import com.yuhan.wagglewaggle.domain.chat.service.ChatHistoryService;
import com.yuhan.wagglewaggle.domain.chat.service.ChatReadService;
import com.yuhan.wagglewaggle.domain.chat.service.ChatRequestService;
import com.yuhan.wagglewaggle.global.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
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
    private final ChatDecisionService chatDecisionService;
    private final ChatReadService chatReadService;
    private final ChatHistoryService chatHistoryService;

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

    /**
     * 채팅 요청에 응답한다(수락/거절/나감). 요청 수신자만 처리할 수 있으며,
     * ACCEPT 시 요청자 −5/수락자 +5 크레딧 이동을 하나의 트랜잭션으로 처리한다.
     * 성공 시 200과 roomId·최종 상태(ACCEPTED/REJECTED/LEFT)를 반환한다.
     */
    @PostMapping("/requests/{roomId}/decision")
    public ApiResponse<ChatDecisionResponse> decide(
            @AuthenticationPrincipal Long memberId,
            @PathVariable Long roomId,
            @RequestBody(required = false) ChatDecisionRequest request
    ) {
        ChatDecisionResponse data = chatDecisionService.decide(memberId, roomId, request);
        return ApiResponse.success(HttpStatus.OK.value(), "채팅 요청 응답이 처리되었습니다.", data);
    }

    /**
     * 채팅방 읽음 위치를 갱신한다. 현재 사용자가 화면에서 마지막으로 확인한 메시지 id를 받아
     * 기존보다 큰 경우에만 갱신하며(단조·멱등), 갱신 후 저장된 last_read_message_id를 반환한다.
     */
    @PatchMapping("/rooms/{roomId}/read")
    public ApiResponse<ChatReadResponse> read(
            @AuthenticationPrincipal Long memberId,
            @PathVariable Long roomId,
            @RequestBody(required = false) ChatReadRequest request
    ) {
        ChatReadResponse data = chatReadService.updateLastRead(memberId, roomId, request);
        return ApiResponse.success(HttpStatus.OK.value(), "채팅방 읽음 위치가 갱신되었습니다.", data);
    }

    /**
     * 채팅 메시지 이력을 조회한다. 참여자(요청자 또는 수신자)만 접근할 수 있으며, 방 컨텍스트
     * (상태·장소·상대방)와 사용자 메시지·안전 경고 이력을 한 번에 반환한다. 종료된 방도 기존 이력은 조회 가능하다.
     */
    @GetMapping("/rooms/{roomId}/messages")
    public ApiResponse<ChatMessagesHistoryResponse> messages(
            @AuthenticationPrincipal Long memberId,
            @PathVariable Long roomId
    ) {
        ChatMessagesHistoryResponse data = chatHistoryService.getHistory(memberId, roomId);
        return ApiResponse.success(HttpStatus.OK.value(), "채팅 메시지 이력 조회가 완료되었습니다.", data);
    }
}
