package com.yuhan.wagglewaggle.domain.pin.service;

import com.yuhan.wagglewaggle.domain.blur.repository.AiBlurJobRepository;
import com.yuhan.wagglewaggle.domain.pin.repository.PinRepository;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import com.yuhan.wagglewaggle.global.properties.PinUploadProperties;
import com.yuhan.wagglewaggle.global.s3.S3ObjectInspector;
import com.yuhan.wagglewaggle.global.s3.S3VideoObjectMetadata;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 영상 교체 요청의 원본 영상 객체 검증(트랜잭션 밖 외부 I/O 포함).
 *
 * <p>핀 등록의 원본 영상 검증과 동일한 규칙을 사용한다.
 * 객체 키 형식·사용자 소유 경로·S3 실존·Content-Type·크기를 확인하고, 이미 사용된 키인지 검사한다.</p>
 *
 * <ul>
 *   <li>키 형식/경로 불일치·S3 미존재·정책 위반 → {@link ErrorCode#VIDEO_NOT_ACCESSIBLE}(422)</li>
 *   <li>Pin 또는 다른 AiBlurJob에 이미 사용된 키 → {@link ErrorCode#VIDEO_ALREADY_REGISTERED}(409)</li>
 * </ul>
 */
@Component
@RequiredArgsConstructor
public class ReplacementVideoValidator {

    private static final String ALLOWED_CONTENT_TYPE = "video/mp4";

    // 원본 영상 객체 키 형식: pins/original/{memberId}/{uuid}.mp4
    private static final Pattern ORIGINAL_VIDEO_KEY_PATTERN = Pattern.compile(
            "^pins/original/(\\d+)/"
                    + "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\\.mp4$");

    private final S3ObjectInspector s3ObjectInspector;
    private final PinRepository pinRepository;
    private final AiBlurJobRepository aiBlurJobRepository;
    private final PinUploadProperties pinUploadProperties;

    /**
     * 교체 영상 객체를 검증한다. 길이 검증은 요청 필드 검증 단계에서 이미 수행됐다고 가정한다.
     */
    public void validate(Long memberId, String originalVideoKey) {
        validateKeyFormatAndOwnership(originalVideoKey, memberId);
        validateObjectAndPolicy(originalVideoKey);
        checkNotAlreadyRegistered(originalVideoKey);
    }

    private void validateKeyFormatAndOwnership(String originalVideoKey, Long memberId) {
        Matcher matcher = ORIGINAL_VIDEO_KEY_PATTERN.matcher(originalVideoKey);
        if (!matcher.matches()) {
            throw new CustomException(ErrorCode.VIDEO_NOT_ACCESSIBLE);
        }
        long keyMemberId;
        try {
            keyMemberId = Long.parseLong(matcher.group(1));
        } catch (NumberFormatException e) {
            throw new CustomException(ErrorCode.VIDEO_NOT_ACCESSIBLE);
        }
        if (memberId == null || memberId != keyMemberId) {
            throw new CustomException(ErrorCode.VIDEO_NOT_ACCESSIBLE);
        }
    }

    private void validateObjectAndPolicy(String originalVideoKey) {
        S3VideoObjectMetadata metadata = s3ObjectInspector.findObjectMetadata(originalVideoKey)
                .orElseThrow(() -> new CustomException(ErrorCode.VIDEO_NOT_ACCESSIBLE));
        if (!ALLOWED_CONTENT_TYPE.equals(metadata.contentType())) {
            throw new CustomException(ErrorCode.VIDEO_NOT_ACCESSIBLE);
        }
        if (metadata.contentLength() > pinUploadProperties.maxVideoSizeBytes()) {
            throw new CustomException(ErrorCode.VIDEO_NOT_ACCESSIBLE);
        }
    }

    private void checkNotAlreadyRegistered(String originalVideoKey) {
        if (pinRepository.existsByOriginalVideoKey(originalVideoKey)
                || aiBlurJobRepository.existsByOriginalVideoKey(originalVideoKey)) {
            throw new CustomException(ErrorCode.VIDEO_ALREADY_REGISTERED);
        }
    }
}
