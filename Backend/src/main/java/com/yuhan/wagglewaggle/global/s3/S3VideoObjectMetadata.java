package com.yuhan.wagglewaggle.global.s3;

/**
 * S3 HeadObject로 확인한 객체 메타데이터. 존재하는 객체의 실제 Content-Type과 크기(byte)를 담는다.
 */
public record S3VideoObjectMetadata(
        String contentType,
        long contentLength
) {
}
