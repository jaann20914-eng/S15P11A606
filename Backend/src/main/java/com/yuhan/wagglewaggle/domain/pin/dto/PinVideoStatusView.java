package com.yuhan.wagglewaggle.domain.pin.dto;

/**
 * 상태 조회 서비스가 컨트롤러에 전달하는 조립 결과.
 *
 * <p>공용 응답 규격상 상태별 안내 문구는 최상위 message 필드로, 실제 데이터는 data로 내려간다.
 * message는 videoStatus에 따라 결정되며 응답 data에는 포함하지 않는다.</p>
 */
public record PinVideoStatusView(
        String message,
        PinVideoStatusResponse data
) {
}
