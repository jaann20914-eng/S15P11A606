package com.yuhan.wagglewaggle.domain.blur.entity;

import com.yuhan.wagglewaggle.domain.pin.entity.VideoStatus;
import org.junit.jupiter.api.Test;

import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 발행 정책상 PUBLISHED 상태를 추가하지 않는다.
 */
class AiBlurStatusPolicyTest {

    @Test
    void AiBlurJobStatus에_PUBLISHED가_없다() {
        assertThat(Arrays.stream(AiBlurJobStatus.values()).map(Enum::name))
                .containsExactlyInAnyOrder("PENDING", "COMPLETED", "FAILED")
                .doesNotContain("PUBLISHED");
    }

    @Test
    void VideoStatus에_PUBLISHED가_없다() {
        assertThat(Arrays.stream(VideoStatus.values()).map(Enum::name))
                .doesNotContain("PUBLISHED");
    }
}
