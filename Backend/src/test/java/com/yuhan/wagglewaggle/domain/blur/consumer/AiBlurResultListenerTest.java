package com.yuhan.wagglewaggle.domain.blur.consumer;

import com.rabbitmq.client.Channel;
import com.yuhan.wagglewaggle.domain.blur.message.AiBlurResultMessage;
import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJob;
import com.yuhan.wagglewaggle.domain.blur.message.FinalStatus;
import com.yuhan.wagglewaggle.domain.blur.message.ProcessingStatus;
import com.yuhan.wagglewaggle.domain.blur.service.AiBlurResultOutcome;
import com.yuhan.wagglewaggle.domain.blur.service.AiBlurResultService;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.orm.ObjectOptimisticLockingFailureException;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

/**
 * ai.blur.result Consumer의 ACK/NACK 동작 단위 테스트.
 */
@ExtendWith(MockitoExtension.class)
class AiBlurResultListenerTest {

    @Mock private AiBlurResultService aiBlurResultService;
    @Mock private Channel channel;

    private AiBlurResultListener listener() {
        return new AiBlurResultListener(aiBlurResultService);
    }

    private static final long DELIVERY_TAG = 7L;
    private static final UUID REQUEST_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID PIN_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private static final Instant COMPLETED_AT = Instant.parse("2026-07-31T12:00:00Z");

    private AiBlurResultMessage passMessage() {
        return new AiBlurResultMessage(REQUEST_ID, PIN_ID, ProcessingStatus.COMPLETED, FinalStatus.PASS,
                "blurred.mp4", "thumb.jpg", null, null, List.of(), 3, 3, 3, 0, 12.5, COMPLETED_AT);
    }

    private AiBlurResultMessage failMessage() {
        return new AiBlurResultMessage(REQUEST_ID, PIN_ID, ProcessingStatus.COMPLETED, FinalStatus.FAIL,
                null, null, "FACE_NOT_BLURRED", null, null, null, null, null, null, null, COMPLETED_AT);
    }

    private AiBlurResultMessage failedMessage() {
        return new AiBlurResultMessage(REQUEST_ID, PIN_ID, ProcessingStatus.FAILED, null,
                null, null, null, "INTERNAL_ERROR", null, null, null, null, null, null, COMPLETED_AT);
    }

    // ---------- ACK ----------

    @Test
    void 정상_PASS_결과는_ACK한다() throws IOException {
        given(aiBlurResultService.apply(any())).willReturn(AiBlurResultOutcome.APPLIED);

        listener().onMessage(passMessage(), channel, DELIVERY_TAG);

        verify(channel).basicAck(DELIVERY_TAG, false);
        verify(channel, never()).basicNack(anyTag(), anyBool(), anyBool());
    }

    @Test
    void 정상_FAIL_결과는_ACK한다() throws IOException {
        given(aiBlurResultService.apply(any())).willReturn(AiBlurResultOutcome.APPLIED);

        listener().onMessage(failMessage(), channel, DELIVERY_TAG);

        verify(channel).basicAck(DELIVERY_TAG, false);
    }

    @Test
    void 정상_FAILED_결과는_ACK한다() throws IOException {
        given(aiBlurResultService.apply(any())).willReturn(AiBlurResultOutcome.APPLIED);

        listener().onMessage(failedMessage(), channel, DELIVERY_TAG);

        verify(channel).basicAck(DELIVERY_TAG, false);
    }

    @Test
    void 중복_결과는_ACK한다() throws IOException {
        given(aiBlurResultService.apply(any())).willReturn(AiBlurResultOutcome.DUPLICATE);

        listener().onMessage(passMessage(), channel, DELIVERY_TAG);

        verify(channel).basicAck(DELIVERY_TAG, false);
        verify(channel, never()).basicNack(anyTag(), anyBool(), anyBool());
    }

    @Test
    void 낙관적_락_충돌_후_같은_결과면_중복으로_ACK한다() throws IOException {
        AiBlurResultMessage message = passMessage();
        given(aiBlurResultService.apply(message))
                .willThrow(new ObjectOptimisticLockingFailureException(AiBlurJob.class, REQUEST_ID));
        given(aiBlurResultService.resolveAfterOptimisticLock(message))
                .willReturn(AiBlurResultOutcome.DUPLICATE);

        listener().onMessage(message, channel, DELIVERY_TAG);

        verify(aiBlurResultService).resolveAfterOptimisticLock(message);
        verify(channel).basicAck(DELIVERY_TAG, false);
        verify(channel, never()).basicNack(anyTag(), anyBool(), anyBool());
    }

    @Test
    void 영상_교체_반영_불가_정상종료는_ACK한다() throws IOException {
        given(aiBlurResultService.apply(any())).willReturn(AiBlurResultOutcome.REPLACEMENT_SKIPPED);

        listener().onMessage(passMessage(), channel, DELIVERY_TAG);

        verify(channel).basicAck(DELIVERY_TAG, false);
        verify(channel, never()).basicNack(anyTag(), anyBool(), anyBool());
    }

    // ---------- NACK → DLQ ----------

    @Test
    void 잘못된_상태_조합은_NACK한다() throws IOException {
        given(aiBlurResultService.apply(any()))
                .willThrow(new CustomException(ErrorCode.INVALID_AI_BLUR_RESULT));

        listener().onMessage(passMessage(), channel, DELIVERY_TAG);

        verify(channel).basicNack(DELIVERY_TAG, false, false);
        verify(channel, never()).basicAck(anyTag(), anyBool());
    }

    @Test
    void 존재하지_않는_requestId는_NACK한다() throws IOException {
        given(aiBlurResultService.apply(any())).willReturn(AiBlurResultOutcome.JOB_NOT_FOUND);

        listener().onMessage(passMessage(), channel, DELIVERY_TAG);

        verify(channel).basicNack(DELIVERY_TAG, false, false);
        verify(channel, never()).basicAck(anyTag(), anyBool());
    }

    @Test
    void S3_결과_객체_없음은_NACK한다() throws IOException {
        given(aiBlurResultService.apply(any())).willReturn(AiBlurResultOutcome.OBJECT_NOT_FOUND);

        listener().onMessage(passMessage(), channel, DELIVERY_TAG);

        verify(channel).basicNack(DELIVERY_TAG, false, false);
    }

    @Test
    void 지원하지_않는_jobType은_NACK한다() throws IOException {
        given(aiBlurResultService.apply(any())).willReturn(AiBlurResultOutcome.UNSUPPORTED_JOB_TYPE);

        listener().onMessage(passMessage(), channel, DELIVERY_TAG);

        verify(channel).basicNack(DELIVERY_TAG, false, false);
    }

    @Test
    void 충돌_결과는_NACK한다() throws IOException {
        given(aiBlurResultService.apply(any())).willReturn(AiBlurResultOutcome.CONFLICT);

        listener().onMessage(failedMessage(), channel, DELIVERY_TAG);

        verify(channel).basicNack(DELIVERY_TAG, false, false);
    }

    @Test
    void 낙관적_락_충돌_후_다른_결과면_NACK한다() throws IOException {
        AiBlurResultMessage message = failMessage();
        given(aiBlurResultService.apply(message))
                .willThrow(new ObjectOptimisticLockingFailureException(AiBlurJob.class, REQUEST_ID));
        given(aiBlurResultService.resolveAfterOptimisticLock(message))
                .willReturn(AiBlurResultOutcome.CONFLICT);

        listener().onMessage(message, channel, DELIVERY_TAG);

        verify(aiBlurResultService).resolveAfterOptimisticLock(message);
        verify(channel).basicNack(DELIVERY_TAG, false, false);
        verify(channel, never()).basicAck(anyTag(), anyBool());
    }

    @Test
    void 낙관적_락_충돌_재확인도_실패하면_NACK한다() throws IOException {
        AiBlurResultMessage message = passMessage();
        given(aiBlurResultService.apply(message))
                .willThrow(new ObjectOptimisticLockingFailureException(AiBlurJob.class, REQUEST_ID));
        given(aiBlurResultService.resolveAfterOptimisticLock(message))
                .willThrow(new RuntimeException("DB 재조회 오류"));

        listener().onMessage(message, channel, DELIVERY_TAG);

        verify(aiBlurResultService, times(1)).resolveAfterOptimisticLock(message);
        verify(channel).basicNack(DELIVERY_TAG, false, false);
        verify(channel, never()).basicAck(anyTag(), anyBool());
    }

    @Test
    void DB_처리_실패는_NACK한다() throws IOException {
        given(aiBlurResultService.apply(any())).willThrow(new RuntimeException("DB 오류"));

        listener().onMessage(passMessage(), channel, DELIVERY_TAG);

        verify(channel).basicNack(DELIVERY_TAG, false, false);
        verify(channel, never()).basicAck(anyTag(), anyBool());
    }

    @Test
    void NACK는_requeue_없이_전송한다() throws IOException {
        given(aiBlurResultService.apply(any())).willReturn(AiBlurResultOutcome.JOB_NOT_FOUND);

        listener().onMessage(passMessage(), channel, DELIVERY_TAG);

        // 세 번째 인자(requeue)가 false여야 DLQ로 이동한다.
        verify(channel).basicNack(DELIVERY_TAG, false, false);
    }

    // ---------- 순서: DB 커밋(서비스 반환) 후 ACK ----------

    @Test
    void 결과_반영_서비스가_반환된_뒤에_ACK한다() throws IOException {
        given(aiBlurResultService.apply(any())).willReturn(AiBlurResultOutcome.APPLIED);

        AiBlurResultMessage message = passMessage();
        listener().onMessage(message, channel, DELIVERY_TAG);

        InOrder inOrder = inOrder(aiBlurResultService, channel);
        inOrder.verify(aiBlurResultService).apply(message);
        inOrder.verify(channel).basicAck(DELIVERY_TAG, false);
    }

    // ---------- 매처 헬퍼 ----------

    private static long anyTag() {
        return org.mockito.ArgumentMatchers.anyLong();
    }

    private static boolean anyBool() {
        return org.mockito.ArgumentMatchers.anyBoolean();
    }
}
