package com.yuhan.wagglewaggle.global.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "aws.s3")
public record S3Properties(
        String bucket,
        String region,
        // 업로드(PUT)용 Presigned URL 만료 시간. 다운로드(GET)와 정책이 다를 수 있어 분리한다.
        long uploadUrlExpirationSeconds,
        // 다운로드(GET)용 Presigned URL 만료 시간. 처리 완료 영상·썸네일 조회에 사용한다.
        long downloadUrlExpirationSeconds
) {
}
