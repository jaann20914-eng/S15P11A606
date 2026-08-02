package com.yuhan.wagglewaggle.global.websocket;

import com.yuhan.wagglewaggle.domain.auth.jwt.JwtProvider;
import com.yuhan.wagglewaggle.domain.auth.jwt.TokenPurpose;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.ExpiredJwtException;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.stereotype.Component;

/**
 * STOMP 프레임(CONNECT, SUBSCRIBE, SEND 등) 인증/권한 검증 인터셉터(클라이언트 인바운드 채널).
 *
 * <p>이 단계에서는 CONNECT 프레임의 Access Token을 검증해 인증 사용자를 세션에 연결한다.
 * 인증 실패 시 {@link CustomException}을 던지면 {@code StompSubProtocolErrorHandler}가 이를
 * ERROR 프레임(오류코드 JSON)으로 변환하고 세션을 종료한다.
 *
 * <p>SUBSCRIBE 권한 검증은 이후 단계에서 이 인터셉터에 추가한다.
 */
@Component
public class StompAuthChannelInterceptor implements ChannelInterceptor {

    private static final String AUTHORIZATION_HEADER = "Authorization";
    private static final String BEARER_PREFIX = "Bearer ";

    private final JwtProvider jwtProvider;

    public StompAuthChannelInterceptor(JwtProvider jwtProvider) {
        this.jwtProvider = jwtProvider;
    }

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor =
                MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

        if (accessor != null && StompCommand.CONNECT.equals(accessor.getCommand())) {
            Long memberId = authenticate(accessor);
            accessor.setUser(new StompPrincipal(memberId));
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
}
