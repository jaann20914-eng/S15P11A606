package com.yuhan.wagglewaggle.domain.chat.controller;

import com.yuhan.wagglewaggle.domain.chat.dto.ChatMessageSendRequest;
import com.yuhan.wagglewaggle.domain.chat.service.ChatMessageService;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.websocket.StompPrincipal;
import com.yuhan.wagglewaggle.global.websocket.SubscriptionErrorEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.Message;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageExceptionHandler;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;

/**
 * 채팅 메시지 전송 STOMP 컨트롤러.
 *
 * <p>클라이언트는 {@code /app/chat/rooms/{roomId}/messages}로 SEND한다. 발신자는 CONNECT 인증에서
 * 세션에 설정된 {@link StompPrincipal}로 식별한다.</p>
 *
 * <p>SEND 프레임은 응답 프레임이 없으므로, 처리 중 발생한 {@link CustomException}은
 * {@code /user/queue/errors}로 오류 이벤트를 push해 알린다({@code StompAuthChannelInterceptor}의
 * 구독 실패 알림과 동일한 봉투·전송 경로를 재사용).</p>
 */
@Slf4j
@Controller
@RequiredArgsConstructor
public class ChatMessageStompController {

    // convertAndSendToUser는 /user prefix를 자동으로 붙이므로 전송 시에는 prefix를 제외한 경로를 쓴다.
    private static final String USER_ERRORS_SEND_DESTINATION = "/queue/errors";

    private final ChatMessageService chatMessageService;
    private final SimpMessagingTemplate messagingTemplate;

    @MessageMapping("/chat/rooms/{roomId}/messages")
    public void send(@DestinationVariable Long roomId,
                     @Payload ChatMessageSendRequest request,
                     Principal principal) {
        Long senderId = ((StompPrincipal) principal).memberId();
        chatMessageService.send(senderId, roomId, request);
    }

    /**
     * 전송 처리 중 던진 {@link CustomException}을 발신자 개인 큐로 전달한다.
     * 세션을 식별할 수 없으면(정상 흐름상 도달하지 않음) 조용히 폐기한다.
     */
    @MessageExceptionHandler(CustomException.class)
    public void handleCustomException(CustomException e, Principal principal, Message<?> message) {
        if (!(principal instanceof StompPrincipal stompPrincipal)) {
            return;
        }
        String destination = SimpMessageHeaderAccessor.getDestination(message.getHeaders());
        SubscriptionErrorEvent event = SubscriptionErrorEvent.of(destination, e.getErrorCode());
        messagingTemplate.convertAndSendToUser(
                stompPrincipal.getName(), USER_ERRORS_SEND_DESTINATION, event);
    }
}
