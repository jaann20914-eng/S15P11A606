package com.yuhan.wagglewaggle.domain.pin.service;

import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * 핀 영상 S3 객체 키 생성 책임.
 * 원본 영상 키 형식: pins/original/{memberId}/{uuid}.mp4
 */
@Component
public class PinVideoKeyGenerator {

    public String generateOriginalVideoKey(Long memberId) {
        return "pins/original/" + memberId + "/" + UUID.randomUUID() + ".mp4";
    }
}
