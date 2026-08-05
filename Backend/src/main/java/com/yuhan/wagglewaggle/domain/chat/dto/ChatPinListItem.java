package com.yuhan.wagglewaggle.domain.chat.dto;

import com.yuhan.wagglewaggle.domain.pin.entity.PublisherStatus;

import java.time.Instant;
import java.util.UUID;

/**
 * 채팅 핀 목록 조회(요청받은 대화) 응답 항목. 내가 요청받은 채팅이 있는 핀 1건을 나타낸다.
 *
 * <p>{@code hasUnread}는 그 핀에서 파생된(내가 수신자인) 채팅방들 중 하나라도 읽지 않은 상대 메시지가
 * 있으면 true다. {@code placeAddress}는 화면 표시용 주소(현재 스키마상 {@code Place.addressName})다.
 * {@code publisherStatus}는 제보자의 현장 체류 상태(STILL_HERE/LEFT)로, 제보자가 현장을 떠났는지 표시한다.</p>
 */
public record ChatPinListItem(
        UUID pinId,
        Instant createdAt,
        String placeName,
        String placeAddress,
        boolean hasUnread,
        PublisherStatus publisherStatus
) {
}
