package com.yuhan.wagglewaggle.domain.pin.tag.service;

import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TagQueryNormalizerTest {

    private final TagQueryNormalizer normalizer = new TagQueryNormalizer();

    // 유효한 지도 경계(남서 < 북동)
    private static final double SW_LAT = 37.5;
    private static final double SW_LNG = 127.0;
    private static final double NE_LAT = 37.6;
    private static final double NE_LNG = 127.1;

    @Test
    void 공백_해시_대문자를_정규화한다() {
        assertThat(normalizer.normalizeAndValidate("  #Date ", SW_LAT, SW_LNG, NE_LAT, NE_LNG)).isEqualTo("date");
        assertThat(normalizer.normalizeAndValidate("#데이트", SW_LAT, SW_LNG, NE_LAT, NE_LNG)).isEqualTo("데이트");
    }

    @Test
    void null이거나_빈값이면_예외를_던진다() {
        assertThatThrownBy(() -> normalizer.normalizeAndValidate(null, SW_LAT, SW_LNG, NE_LAT, NE_LNG))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.INVALID_TAG_SEARCH_QUERY);
        assertThatThrownBy(() -> normalizer.normalizeAndValidate("   #  ", SW_LAT, SW_LNG, NE_LAT, NE_LNG))
                .isInstanceOf(CustomException.class);
    }

    @Test
    void 검색어가_50자를_넘으면_예외를_던진다() {
        String tooLong = "가".repeat(51);
        assertThatThrownBy(() -> normalizer.normalizeAndValidate(tooLong, SW_LAT, SW_LNG, NE_LAT, NE_LNG))
                .isInstanceOf(CustomException.class);
    }

    @Test
    void 경계_좌표가_범위를_벗어나면_예외를_던진다() {
        // 북동 위도 > 90
        assertThatThrownBy(() -> normalizer.normalizeAndValidate("데이트", SW_LAT, SW_LNG, 91.0, NE_LNG))
                .isInstanceOf(CustomException.class);
        // 북동 경도 > 180
        assertThatThrownBy(() -> normalizer.normalizeAndValidate("데이트", SW_LAT, SW_LNG, NE_LAT, 181.0))
                .isInstanceOf(CustomException.class);
    }

    @Test
    void 남서가_북동보다_크거나_같으면_예외를_던진다() {
        // 위도 순서 위반 (남서 위도 >= 북동 위도)
        assertThatThrownBy(() -> normalizer.normalizeAndValidate("데이트", 37.6, SW_LNG, 37.5, NE_LNG))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.INVALID_TAG_SEARCH_QUERY);
        // 경도 순서 위반 (남서 경도 >= 북동 경도)
        assertThatThrownBy(() -> normalizer.normalizeAndValidate("데이트", SW_LAT, 127.1, NE_LAT, 127.0))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.INVALID_TAG_SEARCH_QUERY);
    }
}
