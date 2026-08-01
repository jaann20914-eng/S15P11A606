package com.yuhan.wagglewaggle.domain.pin.dto;

import com.yuhan.wagglewaggle.domain.pin.entity.CrowdLevel;

import java.util.List;

/**
 * 핀 등록 요청 검증을 통과한 뒤의 신뢰 가능한 값 묶음(커맨드).
 * 장소명·좌표는 Front 입력이 아니라 DB 또는 Kakao API로 확인한 값이며,
 * tags는 정규화·중복 제거를 마친 결과다. 다음 단계(실제 저장·발행)에서 이 값을 그대로 사용한다.
 */
public record ValidatedPinCreation(
        Long memberId,
        String originalVideoKey,
        String kakaoPlaceId,
        String resolvedPlaceName,
        double placeLatitude,
        double placeLongitude,
        double captureLatitude,
        double captureLongitude,
        String detailLocation,
        CrowdLevel crowdLevel,
        String memo,
        List<String> tags
) {
}
