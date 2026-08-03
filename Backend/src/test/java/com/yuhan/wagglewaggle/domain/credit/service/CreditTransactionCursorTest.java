package com.yuhan.wagglewaggle.domain.credit.service;

import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CreditTransactionCursorTest {

    @Test
    @DisplayName("인코딩 후 디코딩하면 createdAt(나노초 포함)과 transactionId가 그대로 복원된다")
    void encodeDecode_roundtrip() {
        Instant createdAt = Instant.parse("2026-07-23T03:00:00.123456Z");
        Long id = 123_456_789L;

        String encoded = new CreditTransactionCursor(createdAt, id).encode();
        CreditTransactionCursor decoded = CreditTransactionCursor.decode(encoded);

        assertThat(decoded.createdAt()).isEqualTo(createdAt);
        assertThat(decoded.id()).isEqualTo(id);
    }

    @Test
    @DisplayName("Base64가 아니거나 형식이 잘못된 커서는 INVALID_PAGINATION으로 거부한다")
    void decode_malformed_throwsInvalidPagination() {
        assertInvalidPagination("not-base64!!!");     // Base64 디코딩 실패
        assertInvalidPagination("");                   // 빈 문자열
        assertInvalidPagination(encodeRaw("only:two")); // 구분자 개수 부족
        assertInvalidPagination(encodeRaw("a:b:c:d"));  // 구분자 개수 초과
        assertInvalidPagination(encodeRaw("xx:0:1"));   // epochSecond 숫자 아님
        assertInvalidPagination(encodeRaw("100:0:not-a-number")); // id 숫자 아님
    }

    private void assertInvalidPagination(String cursor) {
        assertThatThrownBy(() -> CreditTransactionCursor.decode(cursor))
                .isInstanceOf(CustomException.class)
                .extracting(e -> ((CustomException) e).getErrorCode())
                .isEqualTo(ErrorCode.INVALID_PAGINATION);
    }

    private String encodeRaw(String raw) {
        return java.util.Base64.getUrlEncoder().withoutPadding()
                .encodeToString(raw.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }
}
