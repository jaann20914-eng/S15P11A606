package com.yuhan.wagglewaggle.domain.pin.dto;

import java.time.Instant;

/**
 * 원본 영상 업로드 정보 발급 응답.
 * 클라이언트는 uploadUrl로 S3에 직접 PUT 업로드하고, 서버는 originalVideoKey를 저장에 사용한다.
 */
public record PinVideoUploadUrlResponse(
        String uploadUrl,
        String originalVideoKey,
        Instant expiresAt
) {
}
