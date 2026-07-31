package com.yuhan.wagglewaggle.global.s3;

import com.yuhan.wagglewaggle.global.properties.S3Properties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

import java.net.URI;
import java.net.URL;
import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class S3PresignedUrlGeneratorTest {

    @Mock
    private S3Presigner s3Presigner;

    private S3PresignedUrlGenerator generator;

    private static final String BUCKET = "test-bucket";
    private static final long EXPIRATION_SECONDS = 600L;
    private static final String KEY = "pins/original/42/11111111-2222-3333-4444-555555555555.mp4";
    private static final String CONTENT_TYPE = "video/mp4";
    private static final String PRESIGNED_URL =
            "https://test-bucket.s3.ap-northeast-2.amazonaws.com/" + KEY + "?X-Amz-Signature=abc";

    @BeforeEach
    void setUp() {
        S3Properties properties = new S3Properties(BUCKET, "ap-northeast-2", EXPIRATION_SECONDS);
        generator = new S3PresignedUrlGenerator(s3Presigner, properties);
    }

    @Test
    void presign_요청에_bucket_key_contentType_만료시간이_올바르게_전달된다() throws Exception {
        PresignedPutObjectRequest presigned = presignedWithUrl(PRESIGNED_URL);
        given(s3Presigner.presignPutObject(any(PutObjectPresignRequest.class))).willReturn(presigned);

        generator.createUploadUrl(KEY, CONTENT_TYPE);

        ArgumentCaptor<PutObjectPresignRequest> captor =
                ArgumentCaptor.forClass(PutObjectPresignRequest.class);
        verify(s3Presigner).presignPutObject(captor.capture());

        PutObjectPresignRequest presignRequest = captor.getValue();
        PutObjectRequest putObjectRequest = presignRequest.putObjectRequest();

        assertThat(putObjectRequest.bucket()).isEqualTo(BUCKET);
        assertThat(putObjectRequest.key()).isEqualTo(KEY);
        assertThat(putObjectRequest.contentType()).isEqualTo(CONTENT_TYPE);
        assertThat(presignRequest.signatureDuration()).isEqualTo(Duration.ofSeconds(EXPIRATION_SECONDS));
    }

    @Test
    void 발급된_presigned_url을_반환한다() throws Exception {
        PresignedPutObjectRequest presigned = presignedWithUrl(PRESIGNED_URL);
        given(s3Presigner.presignPutObject(any(PutObjectPresignRequest.class))).willReturn(presigned);

        PresignedUpload result = generator.createUploadUrl(KEY, CONTENT_TYPE);

        assertThat(result.url()).isEqualTo(PRESIGNED_URL);
        assertThat(result.expiresAt()).isNotNull();
    }

    private static PresignedPutObjectRequest presignedWithUrl(String url) throws Exception {
        URL parsed = URI.create(url).toURL();
        PresignedPutObjectRequest presigned = mock(PresignedPutObjectRequest.class);
        given(presigned.url()).willReturn(parsed);
        return presigned;
    }
}
