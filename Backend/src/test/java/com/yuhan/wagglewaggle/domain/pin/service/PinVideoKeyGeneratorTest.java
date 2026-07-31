package com.yuhan.wagglewaggle.domain.pin.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PinVideoKeyGeneratorTest {

    private final PinVideoKeyGenerator generator = new PinVideoKeyGenerator();

    // pins/original/{memberId}/{uuid}.mp4
    private static final String KEY_PATTERN =
            "^pins/original/42/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\\.mp4$";

    @Test
    void 원본_영상_키가_정책_형식에_맞게_생성된다() {
        String key = generator.generateOriginalVideoKey(42L);

        assertThat(key).matches(KEY_PATTERN);
    }

    @Test
    void 서로_다른_요청은_UUID가_달라진다() {
        String first = generator.generateOriginalVideoKey(42L);
        String second = generator.generateOriginalVideoKey(42L);

        // 같은 memberId라도 UUID 부분이 달라 전체 키가 서로 다르다.
        assertThat(first).isNotEqualTo(second);
        assertThat(first).startsWith("pins/original/42/");
        assertThat(second).startsWith("pins/original/42/");
    }
}
