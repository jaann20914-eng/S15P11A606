package com.yuhan.wagglewaggle.global.s3;

import com.yuhan.wagglewaggle.global.properties.S3Properties;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

import java.time.Duration;
import java.time.Instant;

/**
 * S3 Presigned URL 생성 전용 컴포넌트.
 * 객체 키·컨텐츠 타입 정책은 호출자가 정하고, 여기서는 서명과 만료 시간만 책임진다.
 * 이후 영상 조회(GET) presign 기능도 이 컴포넌트에 메서드로 추가해 재사용한다.
 */
@Component
@RequiredArgsConstructor
public class S3PresignedUrlGenerator {

    private final S3Presigner s3Presigner;
    private final S3Properties s3Properties;

    /**
     * 지정한 키·컨텐츠 타입으로 업로드용 Presigned PUT URL을 발급한다.
     * 만료 시간은 설정값(uploadUrlExpirationSeconds)을 사용하며, Content-Type이 서명 조건에 포함된다.
     */
    public PresignedUpload createUploadUrl(String key, String contentType) {
        Duration ttl = Duration.ofSeconds(s3Properties.uploadUrlExpirationSeconds());

        PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                .bucket(s3Properties.bucket())
                .key(key)
                .contentType(contentType)
                .build();

        PutObjectPresignRequest presignRequest = PutObjectPresignRequest.builder()
                .signatureDuration(ttl)
                .putObjectRequest(putObjectRequest)
                .build();

        PresignedPutObjectRequest presigned = s3Presigner.presignPutObject(presignRequest);

        return new PresignedUpload(presigned.url().toString(), Instant.now().plus(ttl));
    }
}
