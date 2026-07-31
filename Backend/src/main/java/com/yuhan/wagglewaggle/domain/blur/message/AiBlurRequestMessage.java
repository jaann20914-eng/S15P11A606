package com.yuhan.wagglewaggle.domain.blur.message;

import java.time.Instant;
import java.util.UUID;

/**
 * ai.blur.request 메시지 본문.
 * 계약상 jobType은 포함하지 않는다(최초 등록/영상 교체 구분은 Back DB 전용이며 별도 합의 전까지 메시지에 넣지 않는다).
 * requestedAt은 UTC ISO-8601로 직렬화된다.
 */
public record AiBlurRequestMessage(
        UUID requestId,
        UUID pinId,
        String originalVideoKey,
        Instant requestedAt
) {
}
