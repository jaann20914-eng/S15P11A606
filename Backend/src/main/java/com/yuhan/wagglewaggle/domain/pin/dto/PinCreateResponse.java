package com.yuhan.wagglewaggle.domain.pin.dto;

import com.yuhan.wagglewaggle.domain.pin.entity.VideoStatus;

import java.util.UUID;

/**
 * 핀 등록 접수 응답. 생성된 핀 식별자와 영상 상태(접수 시점 PENDING)를 반환한다.
 */
public record PinCreateResponse(
        UUID pinId,
        VideoStatus videoStatus
) {
}
