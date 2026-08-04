package com.yuhan.wagglewaggle.domain.recommendation.dto;

import java.util.List;

/**
 * 추천 장소 카드. places 저장값(장소명·주소·전화번호)과 현재 활성 핀 집계로 구성한다.
 * phone은 등록된 값이 없으면 null이다.
 */
public record PlaceCard(
        long placeId,
        String name,
        String address,
        String phone,
        int activePinCount,
        int uploaderCount,
        String representativeUploaderNickname,
        List<PinPreview> pinPreviews
) {
}
