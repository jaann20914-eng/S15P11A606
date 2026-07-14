package com.ssafy.backend.stomp.chat;

import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

@Controller
public class ChatController {

    private final SimpMessagingTemplate simpMessagingTemplate;

    public ChatController(SimpMessagingTemplate simpMessagingTemplate) {
        this.simpMessagingTemplate = simpMessagingTemplate;
    }

    @MessageMapping("/rooms/{roomId}/messages")
    public void sendMessage(
            @DestinationVariable String roomId,
            ChatMessage message
    ) {
        // Body보다 URL(실제 STOMP 목적지의 roomID)을 기준으로 사용
        message.setRoomId(roomId);

        String destination = "/topic/rooms/" + roomId;

        simpMessagingTemplate.convertAndSend(destination, message);
    }
}
