package com.yuhan.wagglewaggle.domain.pin.service;

import com.yuhan.wagglewaggle.domain.pin.dto.PinUploadUrlRequest;
import com.yuhan.wagglewaggle.domain.pin.dto.PinVideoUploadUrlResponse;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import com.yuhan.wagglewaggle.global.properties.PinUploadProperties;
import com.yuhan.wagglewaggle.global.s3.PresignedUpload;
import com.yuhan.wagglewaggle.global.s3.S3PresignedUrlGenerator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * 원본 영상 업로드 정보 발급 오케스트레이션.
 * 요청 검증(INVALID_UPLOAD_REQUEST) 후 객체 키 생성과 Presigned PUT URL 발급을 조합해 응답을 구성한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PinVideoUploadService {

    // MVP에서는 원본 영상 Content-Type을 video/mp4로만 허용한다.
    private static final String ALLOWED_CONTENT_TYPE = "video/mp4";

    private final PinVideoKeyGenerator pinVideoKeyGenerator;
    private final S3PresignedUrlGenerator s3PresignedUrlGenerator;
    private final PinUploadProperties pinUploadProperties;

    public PinVideoUploadUrlResponse issueOriginalVideoUploadUrl(Long memberId, PinUploadUrlRequest request) {
        validate(request);

        try {
            String originalVideoKey = pinVideoKeyGenerator.generateOriginalVideoKey(memberId);
            PresignedUpload upload = s3PresignedUrlGenerator.createUploadUrl(
                    originalVideoKey, request.contentType());
            return new PinVideoUploadUrlResponse(upload.url(), originalVideoKey, upload.expiresAt());
        } catch (CustomException e) {
            throw e;
        } catch (Exception e) {
            log.error("업로드 URL 발급 실패", e);
            throw new CustomException(ErrorCode.UPLOAD_URL_ISSUE_FAILED);
        }
    }

    private void validate(PinUploadUrlRequest request) {
        boolean invalid = request == null
                || request.contentType() == null
                || !ALLOWED_CONTENT_TYPE.equals(request.contentType())
                || request.fileSize() == null
                || request.fileSize() <= 0
                || request.fileSize() > pinUploadProperties.maxVideoSizeBytes();
        if (invalid) {
            throw new CustomException(ErrorCode.INVALID_UPLOAD_REQUEST);
        }
    }
}
