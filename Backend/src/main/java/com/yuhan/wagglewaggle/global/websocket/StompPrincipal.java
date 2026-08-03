package com.yuhan.wagglewaggle.global.websocket;

import java.security.Principal;

/**
 * WebSocket 세션에 연결되는 인증 사용자 식별자.
 *
 * <p>CONNECT 프레임 인증 성공 시 세션에 설정되며, {@link #getName()}이 반환하는 memberId 문자열이
 * {@code /user/**} 개인 destination 라우팅 키로 사용된다. 즉 클라이언트가 destination에 userId를
 * 직접 넣지 않아도 서버가 이 값을 기준으로 해당 사용자에게만 메시지를 전달한다.
 */
public record StompPrincipal(Long memberId) implements Principal {

    @Override
    public String getName() {
        return String.valueOf(memberId);
    }
}
