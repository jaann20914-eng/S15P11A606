package com.yuhan.wagglewaggle.domain.pin.dto;

/**
 * 원본 영상 업로드 정보 발급 요청.
 * 검증은 서비스에서 통일 처리하므로(INVALID_UPLOAD_REQUEST) Bean Validation 애노테이션을 두지 않는다.
 * 누락을 감지하기 위해 fileSize는 원시타입이 아닌 래퍼(Long)로 받는다.
 */
public record PinUploadUrlRequest(
        String contentType,
        Long fileSize
) {
}
