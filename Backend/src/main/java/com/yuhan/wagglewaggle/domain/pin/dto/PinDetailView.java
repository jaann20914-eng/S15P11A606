package com.yuhan.wagglewaggle.domain.pin.dto;

/**
 * 영상 핀 상세 조회의 내부 결과 모델(현재 사용자 기준).
 *
 * <p>핀의 기본 데이터({@link PinDetail})와 현재 사용자 기준의 접근·상호작용 정보
 * ({@link PinViewerAccess})를 함께 담는다. 외부 응답 DTO 및 Presigned GET URL 조립은
 * 이후 단계에서 이 모델을 기반으로 수행한다.</p>
 */
public record PinDetailView(
        PinDetail detail,
        PinViewerAccess access
) {
}
