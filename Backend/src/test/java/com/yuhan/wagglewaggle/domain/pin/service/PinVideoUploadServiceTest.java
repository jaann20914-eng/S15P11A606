package com.yuhan.wagglewaggle.domain.pin.service;

import com.yuhan.wagglewaggle.domain.pin.dto.PinUploadUrlRequest;
import com.yuhan.wagglewaggle.domain.pin.dto.PinVideoUploadUrlResponse;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import com.yuhan.wagglewaggle.global.properties.PinUploadProperties;
import com.yuhan.wagglewaggle.global.s3.PresignedUpload;
import com.yuhan.wagglewaggle.global.s3.S3PresignedUrlGenerator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PinVideoUploadServiceTest {

    @Mock
    private PinVideoKeyGenerator pinVideoKeyGenerator;

    @Mock
    private S3PresignedUrlGenerator s3PresignedUrlGenerator;

    private PinVideoUploadService service;

    private static final Long MEMBER_ID = 42L;
    private static final long MAX_SIZE = 104_857_600L; // 100MB
    private static final String KEY = "pins/original/42/11111111-2222-3333-4444-555555555555.mp4";
    private static final String UPLOAD_URL = "https://test-bucket.s3.ap-northeast-2.amazonaws.com/upload?sig=abc";
    private static final Instant EXPIRES_AT = Instant.parse("2026-07-31T00:10:00Z");

    @BeforeEach
    void setUp() {
        PinUploadProperties properties = new PinUploadProperties(MAX_SIZE);
        service = new PinVideoUploadService(pinVideoKeyGenerator, s3PresignedUrlGenerator, properties);
    }

    private PinUploadUrlRequest request(String contentType, Long fileSize) {
        return new PinUploadUrlRequest(contentType, fileSize);
    }

    @Test
    void 유효한_요청이면_생성된_키로_presign을_요청하고_응답을_조립한다() {
        given(pinVideoKeyGenerator.generateOriginalVideoKey(MEMBER_ID)).willReturn(KEY);
        given(s3PresignedUrlGenerator.createUploadUrl(eq(KEY), eq("video/mp4")))
                .willReturn(new PresignedUpload(UPLOAD_URL, EXPIRES_AT));

        PinVideoUploadUrlResponse response =
                service.issueOriginalVideoUploadUrl(MEMBER_ID, request("video/mp4", 5_242_880L));

        // 생성된 키와 video/mp4 컨텐츠 타입이 그대로 presign 호출에 전달된다.
        ArgumentCaptor<String> keyCaptor = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> contentTypeCaptor = ArgumentCaptor.forClass(String.class);
        verify(s3PresignedUrlGenerator).createUploadUrl(keyCaptor.capture(), contentTypeCaptor.capture());
        assertThat(keyCaptor.getValue()).isEqualTo(KEY);
        assertThat(contentTypeCaptor.getValue()).isEqualTo("video/mp4");

        // 응답에 uploadUrl / originalVideoKey / expiresAt이 매핑된다.
        assertThat(response.uploadUrl()).isEqualTo(UPLOAD_URL);
        assertThat(response.originalVideoKey()).isEqualTo(KEY);
        assertThat(response.expiresAt()).isEqualTo(EXPIRES_AT);
    }

    @Test
    void 최대_크기_경계값은_허용된다() {
        given(pinVideoKeyGenerator.generateOriginalVideoKey(MEMBER_ID)).willReturn(KEY);
        given(s3PresignedUrlGenerator.createUploadUrl(anyString(), anyString()))
                .willReturn(new PresignedUpload(UPLOAD_URL, EXPIRES_AT));

        PinVideoUploadUrlResponse response =
                service.issueOriginalVideoUploadUrl(MEMBER_ID, request("video/mp4", MAX_SIZE));

        assertThat(response.originalVideoKey()).isEqualTo(KEY);
    }

    @Test
    void 요청_바디가_없으면_INVALID_UPLOAD_REQUEST() {
        assertInvalidUploadRequest(null);
    }

    @Test
    void contentType이_없으면_INVALID_UPLOAD_REQUEST() {
        assertInvalidUploadRequest(request(null, 5_242_880L));
    }

    @Test
    void contentType이_video_mp4가_아니면_INVALID_UPLOAD_REQUEST() {
        assertInvalidUploadRequest(request("image/png", 5_242_880L));
    }

    @Test
    void fileSize가_없으면_INVALID_UPLOAD_REQUEST() {
        assertInvalidUploadRequest(request("video/mp4", null));
    }

    @Test
    void fileSize가_0이면_INVALID_UPLOAD_REQUEST() {
        assertInvalidUploadRequest(request("video/mp4", 0L));
    }

    @Test
    void fileSize가_음수면_INVALID_UPLOAD_REQUEST() {
        assertInvalidUploadRequest(request("video/mp4", -1L));
    }

    @Test
    void fileSize가_최대치를_초과하면_INVALID_UPLOAD_REQUEST() {
        assertInvalidUploadRequest(request("video/mp4", MAX_SIZE + 1));
    }

    @Test
    void presign_발급이_실패하면_UPLOAD_URL_ISSUE_FAILED() {
        given(pinVideoKeyGenerator.generateOriginalVideoKey(MEMBER_ID)).willReturn(KEY);
        given(s3PresignedUrlGenerator.createUploadUrl(anyString(), anyString()))
                .willThrow(new RuntimeException("S3 presign 실패"));

        assertThatThrownBy(() ->
                service.issueOriginalVideoUploadUrl(MEMBER_ID, request("video/mp4", 5_242_880L)))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.UPLOAD_URL_ISSUE_FAILED);
    }

    private void assertInvalidUploadRequest(PinUploadUrlRequest request) {
        assertThatThrownBy(() -> service.issueOriginalVideoUploadUrl(MEMBER_ID, request))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.INVALID_UPLOAD_REQUEST);

        // 검증 실패 시 키 생성·presign은 호출되지 않는다.
        verify(pinVideoKeyGenerator, never()).generateOriginalVideoKey(any());
        verify(s3PresignedUrlGenerator, never()).createUploadUrl(anyString(), anyString());
    }
}
