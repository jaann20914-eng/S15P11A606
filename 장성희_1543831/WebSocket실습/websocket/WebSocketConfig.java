package com.ssafy.backend.websocket;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket // WebSocketHandler 기반 처리 활성화
public class WebSocketConfig implements WebSocketConfigurer {

    private final BroadcastWebSocketHandler broadcastWebSocketHandler;

    public WebSocketConfig(BroadcastWebSocketHandler broadcastWebSocketHandler) {
        this.broadcastWebSocketHandler = broadcastWebSocketHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(broadcastWebSocketHandler, "/ws/broadcast");
    }
}
