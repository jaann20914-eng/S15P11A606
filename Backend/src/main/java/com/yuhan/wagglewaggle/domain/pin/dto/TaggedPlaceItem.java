package com.yuhan.wagglewaggle.domain.pin.dto;

import com.yuhan.wagglewaggle.domain.place.dto.ActivePinResponse;

import java.util.List;

/**
 * 태그 검색 결과의 장소 항목. 해당 태그가 포함된 활성 핀을 activePins로 갖는다.
 * 주소·전화번호는 places 테이블에 저장된 값을 사용한다.
 */
public record TaggedPlaceItem(
        Long placeId,
        String name,
        String address,
        String phone,
        double latitude,
        double longitude,
        List<ActivePinResponse> activePins
) {
}
