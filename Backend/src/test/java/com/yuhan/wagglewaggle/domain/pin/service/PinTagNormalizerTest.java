package com.yuhan.wagglewaggle.domain.pin.service;

import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PinTagNormalizerTest {

    private final PinTagNormalizer normalizer = new PinTagNormalizer();

    @Test
    void 태그가_null이면_빈_목록을_반환한다() {
        assertThat(normalizer.normalizeAndValidate(null)).isEmpty();
    }

    @Test
    void 태그_3개_이하면_공백을_제거해_반환한다() {
        List<String> result = normalizer.normalizeAndValidate(List.of(" 카페 ", "조용함", "wifi"));

        assertThat(result).containsExactly("카페", "조용함", "wifi");
    }

    @Test
    void 태그가_3개를_초과하면_INVALID_REQUEST() {
        List<String> tags = List.of("a", "b", "c", "d");

        assertInvalidRequest(tags);
    }

    @Test
    void 정규화_후_빈_태그가_있으면_INVALID_REQUEST() {
        List<String> tags = Arrays.asList("카페", "   ");

        assertInvalidRequest(tags);
    }

    @Test
    void 태그_길이가_30자를_초과하면_INVALID_REQUEST() {
        List<String> tags = List.of("a".repeat(31));

        assertInvalidRequest(tags);
    }

    @Test
    void 태그_길이가_정확히_30자면_허용된다() {
        String tag = "a".repeat(30);

        assertThat(normalizer.normalizeAndValidate(List.of(tag))).containsExactly(tag);
    }

    @Test
    void 정규화_후_중복_태그가_있으면_INVALID_REQUEST() {
        List<String> tags = List.of("카페", " 카페 ");

        assertInvalidRequest(tags);
    }

    private void assertInvalidRequest(List<String> tags) {
        assertThatThrownBy(() -> normalizer.normalizeAndValidate(tags))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.INVALID_REQUEST);
    }
}
