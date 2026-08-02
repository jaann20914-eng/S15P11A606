package com.yuhan.wagglewaggle.global.websocket;

import com.yuhan.wagglewaggle.domain.auth.jwt.JwtProvider;
import com.yuhan.wagglewaggle.domain.auth.jwt.TokenPurpose;
import com.yuhan.wagglewaggle.domain.chat.repository.ChatRoomRepository;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

import java.util.Optional;

/**
 * STOMP 프레임(CONNECT, SUBSCRIBE 등) 인증/권한 검증 인터셉터(클라이언트 인바운드 채널).
 *
 * <p>CONNECT: Access Token을 검증해 인증 사용자를 세션에 연결한다. 실패 시 {@link CustomException}을
 * 던지면 {@code StompSubProtocolErrorHandler}가 ERROR 프레임으로 변환하고 세션을 종료한다.
 *
 * <p>SUBSCRIBE: 채팅방 실시간 이벤트 구독은 참여자만 허용한다. 검증 실패 시 연결은 유지한 채 해당
 * SUBSCRIBE 프레임만 폐기(preSend가 null 반환)하고, {@code /user/queue/errors}로
 * {@code SUBSCRIPTION_FAILED} 이벤트를 전송한다.
 */
@Component
public class StompAuthChannelInterceptor implements ChannelInterceptor {

    private static final String AUTHORIZATION_HEADER = "Authorization";
    private static final String BEARER_PREFIX = "Bearer ";

    private static final String CHAT_ROOM_TOPIC_PREFIX = "/topic/chat/rooms/";
    private static final String USER_CHAT_ROOMS_DESTINATION = "/user/queue/chat-rooms";
    private static final String USER_ERRORS_DESTINATION = "/user/queue/errors";
    // convertAndSendToUser는 /user prefix를 자동으로 붙이므로 전송 시에는 prefix를 제외한 경로를 쓴다.
    private static final String USER_ERRORS_SEND_DESTINATION = "/queue/errors";

    private final JwtProvider jwtProvider;
    private final ChatRoomRepository chatRoomRepository;
    // SimpMessagingTemplate은 WebSocket 브로커 설정이 생성하는 빈이라 즉시 주입 시 초기화 순환 위험이 있어
    // ObjectProvider로 지연 조회한다.
    private final ObjectProvider<SimpMessagingTemplate> messagingTemplateProvider;

    public StompAuthChannelInterceptor(JwtProvider jwtProvider,
                                       ChatRoomRepository chatRoomRepository,
                                       ObjectProvider<SimpMessagingTemplate> messagingTemplateProvider) {
        this.jwtProvider = jwtProvider;
        this.chatRoomRepository = chatRoomRepository;
        this.messagingTemplateProvider = messagingTemplateProvider;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor =
                MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null) {
            return message;
        }

        StompCommand command = accessor.getCommand();
        if (StompCommand.CONNECT.equals(command)) {
            Long memberId = authenticate(accessor);
            accessor.setUser(new StompPrincipal(memberId));
        } else if (StompCommand.SUBSCRIBE.equals(command)) {
            if (!isSubscriptionAllowed(accessor)) {
                // 구독 거부: 프레임을 폐기해 브로커에 구독이 등록되지 않게 하고, 연결은 유지한다.
                return null;
            }
        }

        return message;
    }

    /**
     * CONNECT 프레임의 Authorization 헤더에서 Access Token을 검증하고 memberId를 반환한다.
     * 토큰 없음/형식 오류/서명 오류/purpose 불일치는 {@code WEBSOCKET_UNAUTHORIZED},
     * 만료는 {@code WEBSOCKET_TOKEN_EXPIRED}로 구분한다.
     */
    private Long authenticate(StompHeaderAccessor accessor) {
        String bearer = accessor.getFirstNativeHeader(AUTHORIZATION_HEADER);
        if (bearer == null || !bearer.startsWith(BEARER_PREFIX)) {
            throw new CustomException(ErrorCode.WEBSOCKET_UNAUTHORIZED);
        }
        String token = bearer.substring(BEARER_PREFIX.length());

        try {
            Claims claims = jwtProvider.parse(token);
            if (jwtProvider.getPurpose(claims) != TokenPurpose.ACCESS) {
                throw new CustomException(ErrorCode.WEBSOCKET_UNAUTHORIZED);
            }
            return Long.valueOf(claims.getSubject());
        } catch (ExpiredJwtException e) {
            throw new CustomException(ErrorCode.WEBSOCKET_TOKEN_EXPIRED);
        } catch (CustomException e) {
            throw e;
        } catch (Exception e) {
            // 서명/형식 오류, purpose 클레임 파싱 실패, subject 숫자 변환 실패 등
            throw new CustomException(ErrorCode.WEBSOCKET_UNAUTHORIZED);
        }
    }

    /**
     * SUBSCRIBE 프레임의 destination 구독 권한을 검증한다.
     * 허용되면 true, 거부되면 {@code /user/queue/errors}로 실패 이벤트를 보낸 뒤 false를 반환한다.
     */
    private boolean isSubscriptionAllowed(StompHeaderAccessor accessor) {
        String destination = accessor.getDestination();
        if (destination == null) {
            return true;
        }
        if (!(accessor.getUser() instanceof StompPrincipal principal)) {
            // 정상 흐름상 CONNECT 인증을 통과한 세션이므로 도달하지 않지만, 방어적으로 거부한다.
            // 세션을 식별할 수 없어 개인 큐로 알림을 보낼 수 없으므로 조용히 폐기한다.
            return false;
        }

        Optional<ErrorCode> denial = validateSubscription(principal.memberId(), destination);
        if (denial.isEmpty()) {
            return true;
        }
        sendSubscriptionError(principal.getName(), destination, denial.get());
        return false;
    }

    private Optional<ErrorCode> validateSubscription(Long memberId, String destination) {
        if (destination.startsWith(CHAT_ROOM_TOPIC_PREFIX)) {
            return validateChatRoomSubscription(memberId, destination);
        }

        // 그 외 destination은 이 인터셉터가 관여하지 않는다.
        return Optional.empty();
    }

    private Optional<ErrorCode> validateChatRoomSubscription(Long memberId, String destination) {
        String roomIdPart = destination.substring(CHAT_ROOM_TOPIC_PREFIX.length());
        long roomId;

        try {
            roomId = Long.parseLong(roomIdPart);
        } catch (NumberFormatException e) {
            return Optional.of(ErrorCode.INVALID_ROOM_ID);
        }

        if (!chatRoomRepository.existsById(roomId)) {
            return Optional.of(ErrorCode.CHAT_ROOM_NOT_FOUND);
        }

        if (!chatRoomRepository.existsByIdAndParticipant(roomId, memberId)) {
            return Optional.of(ErrorCode.CHAT_ROOM_SUBSCRIPTION_DENIED);
        }

        return Optional.empty();
    }

    private void sendSubscriptionError(String userName, String destination, ErrorCode errorCode) {
        SubscriptionErrorEvent event = SubscriptionErrorEvent.of(destination, errorCode);
        messagingTemplateProvider.getObject()
                .convertAndSendToUser(userName, USER_ERRORS_SEND_DESTINATION, event);
    }
}
