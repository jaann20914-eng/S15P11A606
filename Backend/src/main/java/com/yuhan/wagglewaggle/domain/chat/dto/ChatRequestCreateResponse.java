package com.yuhan.wagglewaggle.domain.chat.dto;

import java.util.UUID;

/**
 * 채팅 요청 생성 Response. 새로 생성된 채팅방 id와 요청 대상 핀 id를 반환한다.
 */
public record ChatRequestCreateResponse(Long roomId, UUID pinId) {
}
