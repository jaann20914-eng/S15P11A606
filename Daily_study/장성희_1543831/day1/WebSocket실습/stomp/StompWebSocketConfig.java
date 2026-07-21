package com.ssafy.backend.stomp;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker // 메시지 broker 기반 처리 활성화
public class StompWebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // 클라이언트가 STOMP 연결을 시작할 WebSocket endpoint
        registry.addEndpoint("/ws-stomp");
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // /app으로 시작하는 메시지는 @MessageMapping 메서드로 전달
        registry.setApplicationDestinationPrefixes("/app");

        // /topic으로 발행된 메시지는 해당 목적지를 구독한 클라이언트에게 전달
        // SimpleBroker: Spring 애플리케이션 내부에서 동작하는 메모리 기반 broker
        registry.enableSimpleBroker("/topic");
    }
}
