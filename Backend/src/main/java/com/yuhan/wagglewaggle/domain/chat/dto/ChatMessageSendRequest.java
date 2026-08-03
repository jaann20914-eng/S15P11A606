package com.yuhan.wagglewaggle.domain.chat.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.UUID;

/**
 * STOMP 채팅 메시지 전송 요청 payload.
 *
 * <p>프로젝트에 전역 snake_case 네이밍 전략이 없어(기본 camelCase), 스펙의 {@code client_message_id}
 * 필드는 {@link JsonProperty}로 명시 매핑한다. 검증은 서비스에서 통일 처리한다.</p>
 *
 * @param content         발신 원문
 * @param clientMessageId 클라이언트 생성 멱등 키. (sender_id, client_message_id) 유니크 제약의 슬롯이다.
 */
public record ChatMessageSendRequest(
        String content,
        @JsonProperty("client_message_id") UUID clientMessageId
) {
}
