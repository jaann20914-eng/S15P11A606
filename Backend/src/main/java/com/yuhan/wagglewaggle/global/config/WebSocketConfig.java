package com.yuhan.wagglewaggle.global.config;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Lazy;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * 채팅 실시간 통신용 WebSocket + STOMP 설정.
 *
 * <p>브로커는 내장 SimpleBroker(인메모리)를 사용한다. 수평 확장이 필요해지면 이 클래스의
 * {@link #configureMessageBroker} 한 곳에서 {@code enableStompBrokerRelay}로 교체할 수 있도록
 * 인증/구독 검증 로직과 브로커 설정을 분리해 둔다.
 *
 * <p>이 단계에서는 연결/하트비트만 담당하며 CONNECT 인증·SUBSCRIBE 권한 검증 인터셉터는
 * 이후 단계에서 {@code configureClientInboundChannel}에 추가한다.
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private static final long HEARTBEAT_INTERVAL_MS = 10_000L;

    // Spring WebSocket 설정이 자동 생성하는 브로커 전용 스케줄러를 재사용한다.
    // 별도 TaskScheduler 빈을 만들면 @Scheduled용 스케줄러 선택이 모호해지므로 이 빈을 주입해 쓴다.
    private final TaskScheduler messageBrokerTaskScheduler;

    // messageBrokerTaskScheduler는 이 설정을 다시 참조하는 구조라 즉시 주입 시 순환 참조가 발생한다.
    // @Lazy 지연 프록시로 주입해 생성 시점 사이클을 끊는다.
    public WebSocketConfig(
            @Lazy @Qualifier("messageBrokerTaskScheduler") TaskScheduler messageBrokerTaskScheduler) {
        this.messageBrokerTaskScheduler = messageBrokerTaskScheduler;
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // React Native raw WebSocket 클라이언트이므로 SockJS 폴백은 사용하지 않는다.
        // 네이티브 클라이언트는 브라우저 Origin 헤더를 보내지 않으므로 origin 패턴은 열어 둔다.
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*");
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // /topic: 채팅방 브로드캐스트(1:N), /queue: 사용자 전용 채널(1:1).
        // SimpleBroker가 서버→클라이언트 하트비트를 보내려면 TaskScheduler가 반드시 필요하다.
        registry.enableSimpleBroker("/topic", "/queue")
                .setHeartbeatValue(new long[]{HEARTBEAT_INTERVAL_MS, HEARTBEAT_INTERVAL_MS})
                .setTaskScheduler(messageBrokerTaskScheduler);

        // 클라이언트 발신 전용 prefix. 예: /app/chat/rooms/{roomId}/messages (핸들러는 이후 단계).
        registry.setApplicationDestinationPrefixes("/app");

        // /user/** 개인 destination 라우팅 prefix. Principal.getName()을 세션 식별자로 사용한다.
        // client가 destination에 직접 userId를 안 넣게 만들어서 남의 개인 큐 접근 불가
        registry.setUserDestinationPrefix("/user");
    }
}
