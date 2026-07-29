package com.yuhan.wagglewaggle.domain.pin.tag.service;

import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TagQueryNormalizerTest {

    private final TagQueryNormalizer normalizer = new TagQueryNormalizer();

    @Test
    void 공백_해시_대문자를_정규화한다() {
        assertThat(normalizer.normalizeAndValidate("  #Date ", 37.5, 127.0)).isEqualTo("date");
        assertThat(normalizer.normalizeAndValidate("#데이트", 37.5, 127.0)).isEqualTo("데이트");
    }

    @Test
    void null이거나_빈값이면_예외를_던진다() {
        assertThatThrownBy(() -> normalizer.normalizeAndValidate(null, 37.5, 127.0))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.INVALID_TAG_SEARCH_QUERY);
        assertThatThrownBy(() -> normalizer.normalizeAndValidate("   #  ", 37.5, 127.0))
                .isInstanceOf(CustomException.class);
    }

    @Test
    void 검색어가_50자를_넘으면_예외를_던진다() {
        String tooLong = "가".repeat(51);
        assertThatThrownBy(() -> normalizer.normalizeAndValidate(tooLong, 37.5, 127.0))
                .isInstanceOf(CustomException.class);
    }

    @Test
    void 좌표가_범위를_벗어나면_예외를_던진다() {
        assertThatThrownBy(() -> normalizer.normalizeAndValidate("데이트", 91.0, 127.0))
                .isInstanceOf(CustomException.class);
        assertThatThrownBy(() -> normalizer.normalizeAndValidate("데이트", 37.5, 181.0))
                .isInstanceOf(CustomException.class);
    }
}
