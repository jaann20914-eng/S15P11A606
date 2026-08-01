package com.yuhan.wagglewaggle.domain.pin.dto;

import com.yuhan.wagglewaggle.domain.place.dto.PinCard;

import java.util.List;

/**
 * 태그 검색 확정 응답. 요청한 태그가 포함된 핀 목록을 담는다.
 * 핀 카드는 장소 상세와 동일한 {@link PinCard}를 재사용한다.
 */
public record TaggedPinsResponse(
        List<PinCard> pins
) {
}
