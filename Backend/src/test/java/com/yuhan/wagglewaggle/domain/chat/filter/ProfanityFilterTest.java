package com.yuhan.wagglewaggle.domain.chat.filter;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 욕설 필터 마스킹 단위 테스트. 실제 앱 내부 사전(chat/profanity-words.txt)을 로딩해 검증한다.
 * (사전에 포함된 토큰: 시발, 병신, fuck 등)
 */
class ProfanityFilterTest {

    private ProfanityFilter filter;

    @BeforeEach
    void setUp() {
        filter = new ProfanityFilter();
    }

    @Test
    @DisplayName("욕설 토큰만 같은 길이의 *로 마스킹하고 나머지 문자는 보존한다")
    void 욕설_토큰만_마스킹한다() {
        assertThat(filter.mask("야 시발 안녕")).isEqualTo("야 ** 안녕");
    }

    @Test
    @DisplayName("여러 욕설 토큰이 있으면 모두 마스킹한다")
    void 여러_토큰을_모두_마스킹한다() {
        assertThat(filter.mask("병신 지랄")).isEqualTo("** **");
    }

    @Test
    @DisplayName("영문 욕설은 대소문자를 무시하고 마스킹한다")
    void 영문_욕설은_대소문자를_무시한다() {
        assertThat(filter.mask("FUCK you")).isEqualTo("**** you");
    }

    @Test
    @DisplayName("욕설이 없으면 원문을 그대로 반환한다")
    void 욕설이_없으면_원문을_반환한다() {
        String clean = "안녕하세요 반갑습니다";
        assertThat(filter.mask(clean)).isEqualTo(clean);
    }

    @Test
    @DisplayName("null·빈 문자열은 그대로 반환한다")
    void null과_빈문자열은_그대로_반환한다() {
        assertThat(filter.mask(null)).isNull();
        assertThat(filter.mask("")).isEmpty();
    }
}
