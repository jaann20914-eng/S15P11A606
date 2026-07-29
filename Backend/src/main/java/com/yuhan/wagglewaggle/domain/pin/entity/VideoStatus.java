package com.yuhan.wagglewaggle.domain.pin.entity;

/**
 * 영상 처리 상태. DB의 video_status_type에 대응한다.
 */
public enum VideoStatus {
    PENDING,
    PROCESSING,
    COMPLETED,
    FAILED
}
