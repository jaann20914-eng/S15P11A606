package com.yuhan.wagglewaggle.global.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 원본 영상 업로드 정책 설정. 서버가 허용하는 최대 영상 크기를 환경변수로 관리한다.
 */
@ConfigurationProperties(prefix = "pin.upload")
public record PinUploadProperties(
        long maxVideoSizeBytes
) {
}
