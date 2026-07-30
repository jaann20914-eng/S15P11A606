package com.yuhan.wagglewaggle.domain.user.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;

class NicknamePolicyTest {

    @DisplayName("숫자·영문·완성형 한글 2~12자는 유효하다")
    @ParameterizedTest
    @ValueSource(strings = {"와글러", "ab", "닉네임12", "abcdefghijkl", "가나다라마바사아자차카타"})
    void 유효한_닉네임(String nickname) {
        assertThat(NicknamePolicy.isValid(nickname)).isTrue();
    }

    @DisplayName("길이·문자 규칙을 위반하면 무효다")
    @ParameterizedTest
    @ValueSource(strings = {
            "a",                 // 1자
            "abcdefghijklm",     // 13자
            "hi there",          // 공백
            "닉네임!",           // 특수문자
            "ㄱㄴ",              // 자모
            ""                   // 빈 문자열
    })
    void 무효한_닉네임(String nickname) {
        assertThat(NicknamePolicy.isValid(nickname)).isFalse();
    }

    @DisplayName("null은 무효다")
    @ParameterizedTest
    @NullSource
    void null은_무효(String nickname) {
        assertThat(NicknamePolicy.isValid(nickname)).isFalse();
    }

    @Test
    @DisplayName("정규화는 영문을 소문자로 변환한다")
    void 정규화_소문자() {
        assertThat(NicknamePolicy.normalize("WaGGle")).isEqualTo("waggle");
        assertThat(NicknamePolicy.normalize("와글러")).isEqualTo("와글러");
    }
}
