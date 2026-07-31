package com.yuhan.wagglewaggle.global.s3;

import java.time.Instant;

/**
 * Presigned URL 발급 결과. url과 만료 시각을 함께 담아 반환한다.
 */
public record PresignedUpload(
        String url,
        Instant expiresAt
) {
}
