package com.yuhan.wagglewaggle.domain.blur.message;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * ai.blur.result 메시지 본문(AI 블러 처리 결과 수신 계약).
 *
 * <p>허용되는 상태 조합(자세한 규칙은 {@link AiBlurResultMessageValidator} 참고):
 * <ul>
 *   <li>PASS   : processingStatus=COMPLETED, finalStatus=PASS,  blurredVideoKey/thumbnailKey 필수</li>
 *   <li>FAIL   : processingStatus=COMPLETED, finalStatus=FAIL,  blurredVideoKey/thumbnailKey=null, code 필수</li>
 *   <li>FAILED : processingStatus=FAILED,    finalStatus=null,  blurredVideoKey/thumbnailKey=null, errorCode 필수</li>
 * </ul>
 *
 * <p>completedAt은 UTC ISO-8601로 직렬화된다. 그 외 필드는 상태 조합에 따라 nullable하다.
 */
public record AiBlurResultMessage(
        UUID requestId,
        UUID pinId,
        ProcessingStatus processingStatus,
        FinalStatus finalStatus,
        String blurredVideoKey,
        String thumbnailKey,
        String code,
        String errorCode,
        List<String> reasonCodes,
        Integer detectedFaceCount,
        Integer validatedFaceCount,
        Integer passCount,
        Integer failCount,
        Double processingTimeSeconds,
        Instant completedAt
) {
}
