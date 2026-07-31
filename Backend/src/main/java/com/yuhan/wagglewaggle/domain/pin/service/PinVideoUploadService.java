package com.yuhan.wagglewaggle.domain.pin.service;

import com.yuhan.wagglewaggle.domain.pin.dto.PinVideoUploadUrlResponse;
import com.yuhan.wagglewaggle.global.s3.PresignedUpload;
import com.yuhan.wagglewaggle.global.s3.S3PresignedUrlGenerator;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * 원본 영상 업로드 정보 발급 오케스트레이션.
 * 객체 키 생성과 Presigned PUT URL 발급을 조합해 업로드 응답을 구성한다.
 */
@Service
@RequiredArgsConstructor
public class PinVideoUploadService {

    private static final String ORIGINAL_VIDEO_CONTENT_TYPE = "video/mp4";

    private final PinVideoKeyGenerator pinVideoKeyGenerator;
    private final S3PresignedUrlGenerator s3PresignedUrlGenerator;

    public PinVideoUploadUrlResponse issueOriginalVideoUploadUrl(Long memberId) {
        String originalVideoKey = pinVideoKeyGenerator.generateOriginalVideoKey(memberId);

        PresignedUpload upload = s3PresignedUrlGenerator.createUploadUrl(
                originalVideoKey, ORIGINAL_VIDEO_CONTENT_TYPE);

        return new PinVideoUploadUrlResponse(upload.url(), originalVideoKey, upload.expiresAt());
    }
}
