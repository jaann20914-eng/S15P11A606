package com.yuhan.wagglewaggle.domain.pin.dto;

import java.util.List;

/**
 * 태그 검색 확정 응답. 검색한 태그와, 해당 태그가 포함된 활성 핀을 장소별로 묶은 목록을 담는다.
 */
public record TaggedPlacesResponse(
        String tag,
        List<TaggedPlaceItem> places
) {
}
