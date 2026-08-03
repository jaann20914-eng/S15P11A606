package com.yuhan.wagglewaggle.domain.pin.service;

import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TodayPinCursorTest {

    @Test
    @DisplayName("인코딩 후 디코딩하면 createdAt(나노초 포함)과 pinId가 그대로 복원된다")
    void encodeDecode_roundtrip() {
        Instant createdAt = Instant.parse("2026-08-03T01:30:00.123456Z");
        UUID id = UUID.fromString("15ab5bf8-3395-4ab8-9904-c49e20a01234");

        String encoded = new TodayPinCursor(createdAt, id).encode();
        TodayPinCursor decoded = TodayPinCursor.decode(encoded);

        assertThat(decoded.createdAt()).isEqualTo(createdAt);
        assertThat(decoded.id()).isEqualTo(id);
    }

    @Test
    @DisplayName("Base64가 아니거나 형식이 잘못된 커서는 INVALID_PAGINATION으로 거부한다")
    void decode_malformed_throwsInvalidPagination() {
        assertInvalidPagination("not-base64!!!");        // Base64 디코딩 실패
        assertInvalidPagination("");                      // 빈 문자열
        assertInvalidPagination(encodeRaw("only:two"));   // 구분자 개수 부족
        assertInvalidPagination(encodeRaw("a:b:c:d"));    // 구분자 개수 초과
        assertInvalidPagination(encodeRaw("xx:0:15ab5bf8-3395-4ab8-9904-c49e20a01234")); // 숫자 아님
        assertInvalidPagination(encodeRaw("100:0:not-a-uuid")); // UUID 형식 오류
    }

    private void assertInvalidPagination(String cursor) {
        assertThatThrownBy(() -> TodayPinCursor.decode(cursor))
                .isInstanceOf(CustomException.class)
                .extracting(e -> ((CustomException) e).getErrorCode())
                .isEqualTo(ErrorCode.INVALID_PAGINATION);
    }

    private String encodeRaw(String raw) {
        return java.util.Base64.getUrlEncoder().withoutPadding()
                .encodeToString(raw.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }
}
