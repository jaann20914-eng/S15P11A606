package com.ssafy.backend.signaling;

import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

@Controller
public class SignalingController {

    private final SimpMessagingTemplate simpMessagingTemplate;

    public SignalingController(SimpMessagingTemplate simpMessagingTemplate) {
        this.simpMessagingTemplate = simpMessagingTemplate;
    }

    @MessageMapping("/rooms/{roomId}/signals")
    public void sendSignal(
            @DestinationVariable String roomId,
            SignalMessage signalMessage
    ) {
        signalMessage.setRoomId(roomId);

        String destination = "/topic/rooms/" + roomId + "/signals";
        simpMessagingTemplate.convertAndSend(destination, signalMessage);
    }
}
