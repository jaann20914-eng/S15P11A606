package com.yuhan.wagglewaggle.domain.pin.tag.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class HangulDecomposerTest {

    private final HangulDecomposer decomposer = new HangulDecomposer();

    @Test
    void 완성형_한글을_초중종_자모로_분해한다() {
        assertThat(decomposer.decomposeToJamo("카페")).isEqualTo("ㅋㅏㅍㅔ");
        assertThat(decomposer.decomposeToJamo("최애카페")).isEqualTo("ㅊㅚㅇㅐㅋㅏㅍㅔ");
    }

    @Test
    void 받침_없는_음절은_초성과_중성만_분해한다() {
        assertThat(decomposer.decomposeToJamo("가")).isEqualTo("ㄱㅏ");
    }

    @Test
    void 받침_있는_음절은_종성까지_분해하고_겹받침은_한_글자로_유지한다() {
        assertThat(decomposer.decomposeToJamo("강")).isEqualTo("ㄱㅏㅇ");
        assertThat(decomposer.decomposeToJamo("값")).isEqualTo("ㄱㅏㅄ");
    }

    @Test
    void 오탈자_한_글자_차이는_자모_앞부분이_겹친다() {
        // "카패"(오타)와 "카페"는 마지막 모음(ㅐ/ㅔ)만 달라 자모 prefix가 대부분 겹친다.
        // → ngram 겹침으로 오탈자 매칭이 가능해지는 근거.
        assertThat(decomposer.decomposeToJamo("카패")).isEqualTo("ㅋㅏㅍㅐ");
        assertThat(decomposer.decomposeToJamo("카페")).startsWith("ㅋㅏㅍ");
        assertThat(decomposer.decomposeToJamo("카패")).startsWith("ㅋㅏㅍ");
    }

    @Test
    void 영문과_숫자는_그대로_통과시킨다() {
        assertThat(decomposer.decomposeToJamo("wifi24")).isEqualTo("wifi24");
        assertThat(decomposer.decomposeToJamo("카페24")).isEqualTo("ㅋㅏㅍㅔ24");
    }

    @Test
    void 분해_대상이_null이거나_빈문자열이면_빈문자열을_반환한다() {
        assertThat(decomposer.decomposeToJamo(null)).isEmpty();
        assertThat(decomposer.decomposeToJamo("")).isEmpty();
    }

    @Test
    void 각_음절의_초성만_추출한다() {
        assertThat(decomposer.extractChosung("카페")).isEqualTo("ㅋㅍ");
        assertThat(decomposer.extractChosung("최애카페")).isEqualTo("ㅊㅇㅋㅍ");
    }

    @Test
    void 초성_추출_시_비음절은_그대로_통과시킨다() {
        assertThat(decomposer.extractChosung("카페24")).isEqualTo("ㅋㅍ24");
        assertThat(decomposer.extractChosung(null)).isEmpty();
    }

    @Test
    void 자음_자모로만_이루어진_2자_이상은_초성_질의다() {
        assertThat(decomposer.isChosungQuery("ㅋㅍ")).isTrue();
        assertThat(decomposer.isChosungQuery("ㅊㅇㅋㅍ")).isTrue();
    }

    @Test
    void 완성_음절이나_모음이_섞이면_초성_질의가_아니다() {
        assertThat(decomposer.isChosungQuery("카페")).isFalse();
        assertThat(decomposer.isChosungQuery("ㅋㅏ")).isFalse();
        assertThat(decomposer.isChosungQuery("ㅏㅑ")).isFalse();
    }

    @Test
    void 자음_한_글자는_초성_질의가_아니다() {
        assertThat(decomposer.isChosungQuery("ㅋ")).isFalse();
    }

    @Test
    void 초성_질의_판별_대상이_null이거나_빈문자열이면_거짓이다() {
        assertThat(decomposer.isChosungQuery(null)).isFalse();
        assertThat(decomposer.isChosungQuery("")).isFalse();
    }
}
