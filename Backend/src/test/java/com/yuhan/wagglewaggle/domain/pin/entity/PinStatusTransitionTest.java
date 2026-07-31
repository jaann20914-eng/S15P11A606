package com.yuhan.wagglewaggle.domain.pin.entity;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 핀 영상 상태 전환·만료 규정 검증.
 * 생성 시 PENDING/expiresAt=null → PASS 시 ACTIVE(+1h) / FAIL 시 REJECTED / FAILED 시 FAILED(둘 다 만료 없음).
 */
class PinStatusTransitionTest {

    private Pin newPin() {
        // 상태 전환만 검증하므로 연관/좌표는 null로 둔다.
        return Pin.create(null, null, CrowdLevel.WAGLE, null, null, null,
                "pins/original/1/11111111-2222-3333-4444-555555555555.mp4", null);
    }

    @Test
    void 생성_직후에는_PENDING이고_만료시각이_없다() {
        Pin pin = newPin();

        assertThat(pin.getVideoStatus()).isEqualTo(VideoStatus.PENDING);
        assertThat(pin.getExpiresAt()).isNull();
    }

    @Test
    void activate하면_ACTIVE로_바뀌고_블러영상_썸네일과_처리시각_1시간뒤_만료가_설정된다() {
        Pin pin = newPin();
        Instant processedAt = Instant.parse("2026-07-31T12:00:00Z");

        pin.activate("pins/blurred/1/out.mp4", "pins/thumb/1/out.jpg", processedAt);

        assertThat(pin.getVideoStatus()).isEqualTo(VideoStatus.ACTIVE);
        assertThat(pin.getBlurredVideoKey()).isEqualTo("pins/blurred/1/out.mp4");
        assertThat(pin.getThumbnailKey()).isEqualTo("pins/thumb/1/out.jpg");
        assertThat(pin.getExpiresAt()).isEqualTo(processedAt.plus(1, ChronoUnit.HOURS));
    }

    @Test
    void reject하면_REJECTED이고_만료시각을_설정하지_않는다() {
        Pin pin = newPin();

        pin.reject();

        assertThat(pin.getVideoStatus()).isEqualTo(VideoStatus.REJECTED);
        assertThat(pin.getExpiresAt()).isNull();
    }

    @Test
    void markFailed하면_FAILED이고_만료시각을_설정하지_않는다() {
        Pin pin = newPin();

        pin.markFailed();

        assertThat(pin.getVideoStatus()).isEqualTo(VideoStatus.FAILED);
        assertThat(pin.getExpiresAt()).isNull();
    }
}
