package com.yuhan.wagglewaggle.domain.blur.message;

import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import org.springframework.stereotype.Component;

/**
 * ai.blur.result 메시지의 계약(허용 상태 조합)을 검증한다.
 *
 * <p>검증은 두 단계로 나눈다.
 * <ol>
 *   <li>공통 필수 필드: requestId, pinId, processingStatus, completedAt</li>
 *   <li>상태 조합: processingStatus / finalStatus 조합에 따른 객체 키·코드 필드의 존재 여부</li>
 * </ol>
 *
 * <p>허용 조합
 * <ul>
 *   <li>PASS   : processingStatus=COMPLETED, finalStatus=PASS,  blurredVideoKey/thumbnailKey 필수, code/errorCode 무시</li>
 *   <li>FAIL   : processingStatus=COMPLETED, finalStatus=FAIL,  blurredVideoKey/thumbnailKey=null, code 필수</li>
 *   <li>FAILED : processingStatus=FAILED,    finalStatus=null,  blurredVideoKey/thumbnailKey=null, errorCode 필수</li>
 * </ul>
 *
 * <p>허용되지 않는 조합은 계약 위반으로 보고 {@link CustomException}(ErrorCode.INVALID_AI_BLUR_RESULT)을 던진다.
 * 상태 변경·ACK/NACK 등 후속 처리는 이 검증기의 책임이 아니다.
 */
@Component
public class AiBlurResultMessageValidator {

    public void validate(AiBlurResultMessage message) {
        if (message == null) {
            throw new CustomException(ErrorCode.INVALID_AI_BLUR_RESULT);
        }
        validateCommon(message);
        validateCombination(message);
    }

    private void validateCommon(AiBlurResultMessage message) {
        if (message.requestId() == null
                || message.pinId() == null
                || message.processingStatus() == null
                || message.completedAt() == null) {
            throw new CustomException(ErrorCode.INVALID_AI_BLUR_RESULT);
        }
    }

    private void validateCombination(AiBlurResultMessage message) {
        switch (message.processingStatus()) {
            case COMPLETED -> validateCompleted(message);
            case FAILED -> validateFailed(message);
        }
    }

    /**
     * processingStatus=COMPLETED는 finalStatus가 PASS 또는 FAIL이어야 한다.
     */
    private void validateCompleted(AiBlurResultMessage message) {
        FinalStatus finalStatus = message.finalStatus();
        if (finalStatus == null) {
            throw new CustomException(ErrorCode.INVALID_AI_BLUR_RESULT);
        }
        switch (finalStatus) {
            case PASS -> validatePass(message);
            case FAIL -> validateFail(message);
        }
    }

    /**
     * PASS: 블러 영상 키와 썸네일 키가 반드시 있어야 한다.
     */
    private void validatePass(AiBlurResultMessage message) {
        if (isBlank(message.blurredVideoKey()) || isBlank(message.thumbnailKey())) {
            throw new CustomException(ErrorCode.INVALID_AI_BLUR_RESULT);
        }
    }

    /**
     * FAIL: 블러 영상 키·썸네일 키는 없어야 하고, 실패 사유 code가 있어야 한다.
     */
    private void validateFail(AiBlurResultMessage message) {
        if (message.blurredVideoKey() != null
                || message.thumbnailKey() != null
                || isBlank(message.code())) {
            throw new CustomException(ErrorCode.INVALID_AI_BLUR_RESULT);
        }
    }

    /**
     * FAILED: finalStatus는 null, 객체 키는 없어야 하고, errorCode가 있어야 한다.
     */
    private void validateFailed(AiBlurResultMessage message) {
        if (message.finalStatus() != null
                || message.blurredVideoKey() != null
                || message.thumbnailKey() != null
                || isBlank(message.errorCode())) {
            throw new CustomException(ErrorCode.INVALID_AI_BLUR_RESULT);
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
