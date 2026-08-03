package com.yuhan.wagglewaggle.global.websocket;

import com.yuhan.wagglewaggle.global.exception.ErrorCode;

/**
 * 구독 권한 검증 실패 시 {@code /user/queue/errors}로 전송하는 이벤트.
 *
 * <p>연결은 유지한 채 해당 SUBSCRIBE만 거부됐음을 클라이언트에 알린다. 클라이언트가 이 이벤트를
 * 받으려면 CONNECT 직후 {@code /user/queue/errors}를 먼저 구독하고 있어야 한다.
 */
public record SubscriptionErrorEvent(String eventType, Data data, Error error) {

    public record Data(String destination) {
    }

    public record Error(String code, String message) {
    }

    public static SubscriptionErrorEvent of(String destination, ErrorCode errorCode) {
        return new SubscriptionErrorEvent(
                "SUBSCRIPTION_FAILED",
                new Data(destination),
                new Error(errorCode.name(), errorCode.getMessage()));
    }
}
