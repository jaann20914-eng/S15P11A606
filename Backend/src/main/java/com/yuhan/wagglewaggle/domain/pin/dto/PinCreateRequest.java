package com.yuhan.wagglewaggle.domain.pin.dto;

import java.util.List;

/**
 * 핀 등록(POST /api/v1/pins) 요청.
 * 검증은 서비스에서 통일 처리(정확한 오류 코드 반환)하므로 Bean Validation 애노테이션을 두지 않는다.
 * 누락 감지를 위해 좌표는 원시타입이 아닌 래퍼(Double)로 받는다.
 * placeName/kakaoPlaceLatitude/kakaoPlaceLongitude는 Front가 보낸 참고값이며 최종 검증값으로 신뢰하지 않는다.
 * categoryGroupCode/categoryGroupName/categoryName/phone/addressName은 Front가 카카오 검색 결과에서 받은 장소 부가 정보로,
 * 장소 신규 저장 시 그대로 places 에 저장한다. 카카오가 값을 주지 않는 장소가 흔해 누락(null)될 수 있다.
 * categoryName(카카오 전체 카테고리 경로)은 쇼핑몰/공원 카테고리 분류에 사용한다.
 */
public record PinCreateRequest(
        String originalVideoKey,
        String kakaoPlaceId,
        String placeName,
        Double kakaoPlaceLatitude,
        Double kakaoPlaceLongitude,
        String categoryGroupCode,
        String categoryGroupName,
        String categoryName,
        String phone,
        String addressName,
        Double latitude,
        Double longitude,
        String detailLocation,
        String crowdLevel,
        String memo,
        List<String> tags
) {
}
