package com.yuhan.wagglewaggle.global.s3;

import com.yuhan.wagglewaggle.global.properties.S3Properties;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.S3Exception;

import java.util.Optional;

/**
 * S3 객체 조회(HeadObject) 전용 컴포넌트.
 * 업로드된 원본 영상의 실존 여부·실제 Content-Type·크기를 서버가 직접 확인할 때 사용한다.
 * 객체가 없으면 Optional.empty()를 반환하고, 그 외 S3 오류는 그대로 전파한다.
 */
@Component
@RequiredArgsConstructor
public class S3ObjectInspector {

    private final S3Client s3Client;
    private final S3Properties s3Properties;

    public Optional<S3VideoObjectMetadata> findObjectMetadata(String key) {
        try {
            HeadObjectResponse response = s3Client.headObject(builder -> builder
                    .bucket(s3Properties.bucket())
                    .key(key));
            return Optional.of(new S3VideoObjectMetadata(response.contentType(), response.contentLength()));
        } catch (NoSuchKeyException e) {
            return Optional.empty();
        } catch (S3Exception e) {
            // HeadObject는 존재하지 않는 키에 대해 404(NoSuchKey 없이)로 응답하기도 한다.
            if (e.statusCode() == 404) {
                return Optional.empty();
            }
            throw e;
        }
    }
}
