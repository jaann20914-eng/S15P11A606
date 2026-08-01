package com.yuhan.wagglewaggle.domain.blur.message;

import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * ai.blur.result 메시지 계약(허용 상태 조합) 검증 테스트.
 */
class AiBlurResultMessageValidatorTest {

    private final AiBlurResultMessageValidator validator = new AiBlurResultMessageValidator();

    private static final UUID REQUEST_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID PIN_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private static final Instant COMPLETED_AT = Instant.parse("2026-07-31T12:00:00Z");
    private static final String BLURRED_KEY = "pins/blurred/42/44444444-4444-4444-4444-444444444444.mp4";
    private static final String THUMBNAIL_KEY = "pins/thumbnail/42/55555555-5555-5555-5555-555555555555.jpg";

    private AiBlurResultMessage pass() {
        return new AiBlurResultMessage(REQUEST_ID, PIN_ID, ProcessingStatus.COMPLETED, FinalStatus.PASS,
                BLURRED_KEY, THUMBNAIL_KEY, null, null, List.of(), 3, 3, 3, 0, 12.5, COMPLETED_AT);
    }

    private AiBlurResultMessage fail() {
        return new AiBlurResultMessage(REQUEST_ID, PIN_ID, ProcessingStatus.COMPLETED, FinalStatus.FAIL,
                null, null, "FACE_NOT_BLURRED", null, List.of("LOW_CONFIDENCE"), 3, 1, 1, 2, 8.0, COMPLETED_AT);
    }

    private AiBlurResultMessage failed() {
        return new AiBlurResultMessage(REQUEST_ID, PIN_ID, ProcessingStatus.FAILED, null,
                null, null, null, "INTERNAL_ERROR", null, null, null, null, null, null, COMPLETED_AT);
    }

    private void assertRejected(AiBlurResultMessage message) {
        assertThatThrownBy(() -> validator.validate(message))
                .isInstanceOf(CustomException.class)
                .extracting(e -> ((CustomException) e).getErrorCode())
                .isEqualTo(ErrorCode.INVALID_AI_BLUR_RESULT);
    }

    @Nested
    class 허용하는_조합 {

        @Test
        void PASS_조합은_통과한다() {
            assertThatCode(() -> validator.validate(pass())).doesNotThrowAnyException();
        }

        @Test
        void FAIL_조합은_통과한다() {
            assertThatCode(() -> validator.validate(fail())).doesNotThrowAnyException();
        }

        @Test
        void FAILED_조합은_통과한다() {
            assertThatCode(() -> validator.validate(failed())).doesNotThrowAnyException();
        }

        @Test
        void PASS_에서_reasonCodes가_null이어도_통과한다() {
            AiBlurResultMessage message = new AiBlurResultMessage(REQUEST_ID, PIN_ID,
                    ProcessingStatus.COMPLETED, FinalStatus.PASS,
                    BLURRED_KEY, THUMBNAIL_KEY, null, null, null, null, null, null, null, null, COMPLETED_AT);
            assertThatCode(() -> validator.validate(message)).doesNotThrowAnyException();
        }
    }

    @Nested
    class 공통_필수_필드_누락 {

        @Test
        void 메시지가_null이면_거부한다() {
            assertRejected(null);
        }

        @Test
        void requestId가_null이면_거부한다() {
            assertRejected(new AiBlurResultMessage(null, PIN_ID, ProcessingStatus.COMPLETED, FinalStatus.PASS,
                    BLURRED_KEY, THUMBNAIL_KEY, null, null, null, null, null, null, null, null, COMPLETED_AT));
        }

        @Test
        void pinId가_null이면_거부한다() {
            assertRejected(new AiBlurResultMessage(REQUEST_ID, null, ProcessingStatus.COMPLETED, FinalStatus.PASS,
                    BLURRED_KEY, THUMBNAIL_KEY, null, null, null, null, null, null, null, null, COMPLETED_AT));
        }

        @Test
        void processingStatus가_null이면_거부한다() {
            assertRejected(new AiBlurResultMessage(REQUEST_ID, PIN_ID, null, FinalStatus.PASS,
                    BLURRED_KEY, THUMBNAIL_KEY, null, null, null, null, null, null, null, null, COMPLETED_AT));
        }

        @Test
        void completedAt이_null이면_거부한다() {
            assertRejected(new AiBlurResultMessage(REQUEST_ID, PIN_ID, ProcessingStatus.COMPLETED, FinalStatus.PASS,
                    BLURRED_KEY, THUMBNAIL_KEY, null, null, null, null, null, null, null, null, null));
        }
    }

    @Nested
    class PASS_조합_위반 {

        @Test
        void blurredVideoKey가_없으면_거부한다() {
            assertRejected(new AiBlurResultMessage(REQUEST_ID, PIN_ID, ProcessingStatus.COMPLETED, FinalStatus.PASS,
                    null, THUMBNAIL_KEY, null, null, null, null, null, null, null, null, COMPLETED_AT));
        }

        @Test
        void thumbnailKey가_없으면_거부한다() {
            assertRejected(new AiBlurResultMessage(REQUEST_ID, PIN_ID, ProcessingStatus.COMPLETED, FinalStatus.PASS,
                    BLURRED_KEY, null, null, null, null, null, null, null, null, null, COMPLETED_AT));
        }

        @Test
        void blurredVideoKey가_공백이면_거부한다() {
            assertRejected(new AiBlurResultMessage(REQUEST_ID, PIN_ID, ProcessingStatus.COMPLETED, FinalStatus.PASS,
                    "  ", THUMBNAIL_KEY, null, null, null, null, null, null, null, null, COMPLETED_AT));
        }
    }

    @Nested
    class FAIL_조합_위반 {

        @Test
        void code가_없으면_거부한다() {
            assertRejected(new AiBlurResultMessage(REQUEST_ID, PIN_ID, ProcessingStatus.COMPLETED, FinalStatus.FAIL,
                    null, null, null, null, null, null, null, null, null, null, COMPLETED_AT));
        }

        @Test
        void blurredVideoKey가_있으면_거부한다() {
            assertRejected(new AiBlurResultMessage(REQUEST_ID, PIN_ID, ProcessingStatus.COMPLETED, FinalStatus.FAIL,
                    BLURRED_KEY, null, "FACE_NOT_BLURRED", null, null, null, null, null, null, null, COMPLETED_AT));
        }

        @Test
        void thumbnailKey가_있으면_거부한다() {
            assertRejected(new AiBlurResultMessage(REQUEST_ID, PIN_ID, ProcessingStatus.COMPLETED, FinalStatus.FAIL,
                    null, THUMBNAIL_KEY, "FACE_NOT_BLURRED", null, null, null, null, null, null, null, COMPLETED_AT));
        }
    }

    @Nested
    class COMPLETED_인데_finalStatus_누락 {

        @Test
        void finalStatus가_null이면_거부한다() {
            assertRejected(new AiBlurResultMessage(REQUEST_ID, PIN_ID, ProcessingStatus.COMPLETED, null,
                    BLURRED_KEY, THUMBNAIL_KEY, null, null, null, null, null, null, null, null, COMPLETED_AT));
        }
    }

    @Nested
    class FAILED_조합_위반 {

        @Test
        void errorCode가_없으면_거부한다() {
            assertRejected(new AiBlurResultMessage(REQUEST_ID, PIN_ID, ProcessingStatus.FAILED, null,
                    null, null, null, null, null, null, null, null, null, null, COMPLETED_AT));
        }

        @Test
        void finalStatus가_있으면_거부한다() {
            assertRejected(new AiBlurResultMessage(REQUEST_ID, PIN_ID, ProcessingStatus.FAILED, FinalStatus.FAIL,
                    null, null, null, "INTERNAL_ERROR", null, null, null, null, null, null, COMPLETED_AT));
        }

        @Test
        void blurredVideoKey가_있으면_거부한다() {
            assertRejected(new AiBlurResultMessage(REQUEST_ID, PIN_ID, ProcessingStatus.FAILED, null,
                    BLURRED_KEY, null, null, "INTERNAL_ERROR", null, null, null, null, null, null, COMPLETED_AT));
        }

        @Test
        void thumbnailKey가_있으면_거부한다() {
            assertRejected(new AiBlurResultMessage(REQUEST_ID, PIN_ID, ProcessingStatus.FAILED, null,
                    null, THUMBNAIL_KEY, null, "INTERNAL_ERROR", null, null, null, null, null, null, COMPLETED_AT));
        }
    }
}
