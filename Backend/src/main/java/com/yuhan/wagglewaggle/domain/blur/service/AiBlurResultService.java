package com.yuhan.wagglewaggle.domain.blur.service;

import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJob;
import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJobStatus;
import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJobType;
import com.yuhan.wagglewaggle.domain.blur.message.AiBlurResultMessage;
import com.yuhan.wagglewaggle.domain.blur.message.AiBlurResultMessageValidator;
import com.yuhan.wagglewaggle.domain.blur.message.ProcessingStatus;
import com.yuhan.wagglewaggle.domain.blur.repository.AiBlurJobRepository;
import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import com.yuhan.wagglewaggle.domain.pin.repository.PinRepository;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import com.yuhan.wagglewaggle.global.s3.S3ObjectInspector;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/**
 * AI 블러 처리 결과(ai.blur.result)를 DB에 반영하는 트랜잭션 서비스.
 *
 * <p>공통 처리
 * <ol>
 *   <li>메시지의 requestId로 AiBlurJob을 조회한다.</li>
 *   <li>상태 변경 대상 Pin은 메시지의 pinId가 아니라 AiBlurJob에 저장된 pinId로 조회한다.</li>
 *   <li>메시지의 pinId는 로그·추적 목적으로만 사용한다.</li>
 *   <li>originalVideoKey 일치 검증은 하지 않는다.</li>
 *   <li>AiBlurJob이 이미 COMPLETED/FAILED면 중복(또는 충돌) 결과로 보고 추가 변경 없이 종료한다.</li>
 *   <li>Pin과 AiBlurJob 변경은 하나의 트랜잭션에서 처리한다.</li>
 *   <li>completedAt은 결과 메시지의 UTC 시각을 사용한다.</li>
 * </ol>
 *
 * <p>이번 브랜치에서는 jobType=INITIAL_UPLOAD만 반영한다. VIDEO_REPLACEMENT는 후속 영상 교체 기능에서
 * 처리하며, 여기서는 Pin을 변경하지 않고 처리 불가({@link AiBlurResultOutcome#UNSUPPORTED_JOB_TYPE})로 반환한다.
 *
 * <p>RabbitMQ Listener·ACK/NACK, 크레딧·알림·장소 점수 재계산은 이 단계의 범위가 아니다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AiBlurResultService {

    private final AiBlurResultMessageValidator validator;
    private final AiBlurJobRepository aiBlurJobRepository;
    private final PinRepository pinRepository;
    private final S3ObjectInspector s3ObjectInspector;

    @Transactional
    public AiBlurResultOutcome apply(AiBlurResultMessage message) {
        validator.validate(message);

        AiBlurJob job = aiBlurJobRepository.findById(message.requestId()).orElse(null);
        if (job == null) {
            log.warn("AI 블러 결과의 작업을 찾을 수 없음 (requestId={}, pinId(msg)={})",
                    message.requestId(), message.pinId());
            return AiBlurResultOutcome.JOB_NOT_FOUND;
        }

        if (isTerminal(job.getStatus())) {
            return resolveTerminalOutcome(job, message);
        }

        if (job.getJobType() != AiBlurJobType.INITIAL_UPLOAD) {
            log.warn("이번 단계에서 처리하지 않는 작업 유형 (requestId={}, jobType={}). Pin을 변경하지 않는다.",
                    job.getRequestId(), job.getJobType());
            return AiBlurResultOutcome.UNSUPPORTED_JOB_TYPE;
        }

        // 상태 변경 대상 Pin은 반드시 작업(job)의 pinId로 조회한다. 메시지 pinId는 추적용이다.
        if (!job.getPinId().equals(message.pinId())) {
            log.warn("메시지 pinId({})와 작업 pinId({})가 다르다. 작업 pinId를 기준으로 처리한다.",
                    message.pinId(), job.getPinId());
        }
        Pin pin = pinRepository.findById(job.getPinId())
                .orElseThrow(() -> new CustomException(ErrorCode.AI_BLUR_PIN_NOT_FOUND));

        return switch (message.processingStatus()) {
            case FAILED -> applyFailed(pin, job, message.completedAt());
            case COMPLETED -> switch (message.finalStatus()) {
                case PASS -> applyPass(pin, job, message);
                case FAIL -> applyFail(pin, job, message.completedAt());
            };
        };
    }

    /**
     * PASS: 블러 영상·썸네일이 S3에 실제로 존재할 때만 Pin을 ACTIVE로 전환한다.
     * 하나라도 확인할 수 없으면 DB를 변경하지 않는다(작업은 PENDING으로 남겨 재처리 여지를 둔다).
     */
    private AiBlurResultOutcome applyPass(Pin pin, AiBlurJob job, AiBlurResultMessage message) {
        if (!objectExists(message.blurredVideoKey()) || !objectExists(message.thumbnailKey())) {
            log.warn("PASS이지만 블러 영상·썸네일 객체를 확인할 수 없어 DB를 변경하지 않음 (requestId={})",
                    job.getRequestId());
            return AiBlurResultOutcome.OBJECT_NOT_FOUND;
        }
        pin.activate(message.blurredVideoKey(), message.thumbnailKey(), message.completedAt());
        job.markCompleted(message.completedAt());
        return AiBlurResultOutcome.APPLIED;
    }

    /**
     * FAIL: Pin을 REJECTED로, 작업을 COMPLETED로 반영한다. 영상 객체 키는 저장하지 않는다.
     */
    private AiBlurResultOutcome applyFail(Pin pin, AiBlurJob job, Instant completedAt) {
        pin.reject();
        job.markCompleted(completedAt);
        return AiBlurResultOutcome.APPLIED;
    }

    /**
     * FAILED: 시스템 처리 실패. Pin을 FAILED로, 작업을 FAILED로 반영한다.
     */
    private AiBlurResultOutcome applyFailed(Pin pin, AiBlurJob job, Instant completedAt) {
        pin.markFailed();
        job.markFailed(completedAt);
        return AiBlurResultOutcome.APPLIED;
    }

    private boolean objectExists(String key) {
        return s3ObjectInspector.findObjectMetadata(key).isPresent();
    }

    private boolean isTerminal(AiBlurJobStatus status) {
        return status == AiBlurJobStatus.COMPLETED || status == AiBlurJobStatus.FAILED;
    }

    /**
     * 이미 최종 상태인 작업에 결과가 다시 도착한 경우. 기존 상태를 유지하고 유형만 구분한다.
     * 수신 결과가 기존 상태와 같으면 중복(DUPLICATE), 다르면 충돌(CONFLICT)이다.
     */
    private AiBlurResultOutcome resolveTerminalOutcome(AiBlurJob job, AiBlurResultMessage message) {
        AiBlurJobStatus expected = expectedJobStatus(message.processingStatus());
        if (job.getStatus() == expected) {
            log.info("이미 처리된 작업의 중복 결과 (requestId={}, status={})", job.getRequestId(), job.getStatus());
            return AiBlurResultOutcome.DUPLICATE;
        }
        log.warn("이미 처리된 작업에 충돌 결과 도착. 기존 상태 유지 (requestId={}, 기존={}, 수신 processingStatus={})",
                job.getRequestId(), job.getStatus(), message.processingStatus());
        return AiBlurResultOutcome.CONFLICT;
    }

    private AiBlurJobStatus expectedJobStatus(ProcessingStatus processingStatus) {
        return processingStatus == ProcessingStatus.FAILED
                ? AiBlurJobStatus.FAILED
                : AiBlurJobStatus.COMPLETED;
    }
}
