package com.yuhan.wagglewaggle.domain.pin.service;

import com.yuhan.wagglewaggle.domain.pin.dto.PinVideoUploadUrlResponse;
import com.yuhan.wagglewaggle.global.s3.PresignedUpload;
import com.yuhan.wagglewaggle.global.s3.S3PresignedUrlGenerator;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class PinVideoUploadServiceTest {

    @Mock
    private PinVideoKeyGenerator pinVideoKeyGenerator;

    @Mock
    private S3PresignedUrlGenerator s3PresignedUrlGenerator;

    private PinVideoUploadService service;

    private static final Long MEMBER_ID = 42L;
    private static final String KEY = "pins/original/42/11111111-2222-3333-4444-555555555555.mp4";
    private static final String UPLOAD_URL = "https://test-bucket.s3.ap-northeast-2.amazonaws.com/upload?sig=abc";
    private static final Instant EXPIRES_AT = Instant.parse("2026-07-31T00:10:00Z");

    @org.junit.jupiter.api.BeforeEach
    void setUp() {
        service = new PinVideoUploadService(pinVideoKeyGenerator, s3PresignedUrlGenerator);
    }

    @Test
    void 생성된_키로_video_mp4_presign을_요청하고_응답을_조립한다() {
        given(pinVideoKeyGenerator.generateOriginalVideoKey(MEMBER_ID)).willReturn(KEY);
        given(s3PresignedUrlGenerator.createUploadUrl(eq(KEY), eq("video/mp4")))
                .willReturn(new PresignedUpload(UPLOAD_URL, EXPIRES_AT));

        PinVideoUploadUrlResponse response = service.issueOriginalVideoUploadUrl(MEMBER_ID);

        // presign 호출에 생성된 키와 video/mp4 컨텐츠 타입이 그대로 전달된다.
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
}
