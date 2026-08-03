package com.yuhan.wagglewaggle.domain.pin.dto;

import com.yuhan.wagglewaggle.domain.pin.entity.VideoStatus;

/**
 * 오늘 등록 핀 목록 응답에서 노출하는 핀 처리 상태(외부 표현).
 *
 * <p>내부 저장 상태({@link VideoStatus})를 그대로 노출하지 않고 아래와 같이 대응해 반환한다.
 * <ul>
 *   <li>PENDING  → PROCESSING</li>
 *   <li>ACTIVE   → ACTIVE</li>
 *   <li>REJECTED → RESHOOT</li>
 *   <li>FAILED   → FAILED</li>
 * </ul>
 */
public enum TodayPinStatus {
    PROCESSING,
    ACTIVE,
    RESHOOT,
    FAILED;

    /**
     * 내부 영상 상태를 외부 표현 상태로 변환한다.
     */
    public static TodayPinStatus from(VideoStatus videoStatus) {
        return switch (videoStatus) {
            case PENDING -> PROCESSING;
            case ACTIVE -> ACTIVE;
            case REJECTED -> RESHOOT;
            case FAILED -> FAILED;
        };
    }
}
