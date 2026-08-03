package com.yuhan.wagglewaggle.global.websocket;

import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import org.springframework.messaging.Message;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.stereotype.Component;
import org.springframework.util.MimeTypeUtils;
import org.springframework.web.socket.messaging.StompSubProtocolErrorHandler;

import java.nio.charset.StandardCharsets;

/**
 * STOMP 처리 중 발생한 예외를 클라이언트로 보내는 ERROR 프레임으로 변환한다.
 *
 * <p>CONNECT 인증 실패 등에서 인터셉터가 던진 {@link CustomException}은 프레임워크에 의해
 * {@code MessageDeliveryException}으로 래핑되어 전달되므로, cause 체인을 따라가 원래 오류코드를 찾는다.
 * 매핑되는 오류코드가 없으면 {@code WEBSOCKET_CONNECTION_FAILED}로 폴백한다.
 *
 * <p>ERROR 프레임 본문에는 REST 공통 응답 대신 {@code {"code","message"}} JSON만 싣는다.
 */
@Component
public class StompErrorHandler extends StompSubProtocolErrorHandler {

    @Override
    public Message<byte[]> handleClientMessageProcessingError(Message<byte[]> clientMessage, Throwable ex) {
        ErrorCode errorCode = resolveErrorCode(ex);

        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.ERROR);
        accessor.setMessage(errorCode.name());
        accessor.setContentType(MimeTypeUtils.APPLICATION_JSON);
        accessor.setLeaveMutable(true);

        String body = String.format(
                "{\"code\":\"%s\",\"message\":\"%s\"}",
                errorCode.name(), errorCode.getMessage());

        return MessageBuilder.createMessage(
                body.getBytes(StandardCharsets.UTF_8), accessor.getMessageHeaders());
    }

    private ErrorCode resolveErrorCode(Throwable ex) {
        Throwable cause = ex;
        while (cause != null) {
            if (cause instanceof CustomException customException) {
                return customException.getErrorCode();
            }
            cause = cause.getCause();
        }
        return ErrorCode.WEBSOCKET_CONNECTION_FAILED;
    }
}
