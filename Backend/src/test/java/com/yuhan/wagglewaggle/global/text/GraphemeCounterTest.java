package com.yuhan.wagglewaggle.global.text;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class GraphemeCounterTest {

    @Test
    void null과_빈문자열은_0이다() {
        assertThat(GraphemeCounter.count(null)).isZero();
        assertThat(GraphemeCounter.count("")).isZero();
    }

    @Test
    void 한글과_영문은_각각_1자로_센다() {
        assertThat(GraphemeCounter.count("안녕")).isEqualTo(2);
        assertThat(GraphemeCounter.count("abc")).isEqualTo(3);
        assertThat(GraphemeCounter.count("가나다123")).isEqualTo(6);
    }

    @Test
    void BMP_밖_이모지는_1자로_센다() {
        // 😀 U+1F600: String.length()는 2(서로게이트 페어)지만 자소는 1.
        assertThat("😀".length()).isEqualTo(2);
        assertThat(GraphemeCounter.count("😀")).isEqualTo(1);
        assertThat(GraphemeCounter.count("😀".repeat(50))).isEqualTo(50);
    }

    @Test
    void ZWJ_가족_이모지는_1자로_센다() {
        // 👨‍👩‍👧‍👦: 코드포인트 7개(ZWJ 결합)지만 사람이 보는 글자는 1.
        String family = "👨‍👩‍👧‍👦";
        assertThat(family.codePointCount(0, family.length())).isGreaterThan(1);
        assertThat(GraphemeCounter.count(family)).isEqualTo(1);
    }

    @Test
    void 피부색_조합_이모지는_1자로_센다() {
        // 👍🏽: 손 이모지 + 피부색 수정자 결합.
        assertThat(GraphemeCounter.count("👍🏽")).isEqualTo(1);
    }

    @Test
    void 이모지와_일반문자가_섞이면_각_자소를_1씩_센다() {
        assertThat(GraphemeCounter.count("안녕😀")).isEqualTo(3);
    }
}
