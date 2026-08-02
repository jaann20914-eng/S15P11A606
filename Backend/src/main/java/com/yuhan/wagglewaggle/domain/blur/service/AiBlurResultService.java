package com.yuhan.wagglewaggle.domain.blur.service;

import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJob;
import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJobStatus;
import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJobType;
import com.yuhan.wagglewaggle.domain.blur.message.AiBlurResultMessage;
import com.yuhan.wagglewaggle.domain.blur.message.AiBlurResultMessageValidator;
import com.yuhan.wagglewaggle.domain.blur.message.ProcessingStatus;
import com.yuhan.wagglewaggle.domain.blur.repository.AiBlurJobRepository;
import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import com.yuhan.wagglewaggle.domain.pin.entity.VideoStatus;
import com.yuhan.wagglewaggle.domain.pin.repository.PinRepository;
import com.yuhan.wagglewaggle.domain.place.service.PlaceScoreRecalculationPort;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import com.yuhan.wagglewaggle.global.s3.S3ObjectInspector;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Clock;
import java.time.Instant;

/**
 * AI 블러 처리 결과(ai.blur.result)를 DB에 반영하는 트랜잭션 서비스.
 *
 * <p>공통 처리
 * <ol>
 *   <li>메시지의 requestId로 AiBlurJob을 조회한다.</li>
 *   <li>상태 변경 대상 Pin은 메시지의 pinId가 아니라 AiBlurJob에 저장된 pinId로 조회한다.</li>
 *   <li>메시지의 pinId는 로그·추적 목적으로만 사용한다(일치 검증하지 않음).</li>
 *   <li>AiBlurJob이 이미 COMPLETED/FAILED면 중복(또는 충돌) 결과로 보고 추가 변경 없이 종료한다(멱등).</li>
 *   <li>Pin과 AiBlurJob 변경은 하나의 트랜잭션에서 처리한다.</li>
 * </ol>
 *
 * <p>jobType별 처리
 * <ul>
 *   <li>INITIAL_UPLOAD: 최초 등록. PASS→ACTIVE, FAIL→REJECTED, FAILED→FAILED. (기존 로직 유지)</li>
 *   <li>VIDEO_REPLACEMENT: 영상 교체. 기존 공개(ACTIVE) 영상을 유지한 채, 최신 교체 작업의 PASS만
 *       원자적으로 새 영상으로 교체한다. FAIL·FAILED와 반영 불가 결과는 기존 영상을 유지하고 작업만 종료한다.</li>
 * </ul>
 *
 * <p>삭제 대상 등록·장소 점수 재계산은 DB 커밋 이후 수행한다({@link #runAfterCommit}).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AiBlurResultService {

    private final AiBlurResultMessageValidator validator;
    private final AiBlurJobRepository aiBlurJobRepository;
    private final PinRepository pinRepository;
    private final S3ObjectInspector s3ObjectInspector;
    private final VideoObjectCleanupPort videoObjectCleanupPort;
    private final PlaceScoreRecalculationPort placeScoreRecalculationPort;
    private final Clock clock;

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

        return switch (job.getJobType()) {
            case INITIAL_UPLOAD -> applyInitialUpload(job, message);
            case VIDEO_REPLACEMENT -> applyReplacement(job, message);
        };
    }

    // ===================== INITIAL_UPLOAD (기존 로직 유지) =====================

    private AiBlurResultOutcome applyInitialUpload(AiBlurJob job, AiBlurResultMessage message) {
        Pin pin = loadPin(job, message);
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

    // ===================== VIDEO_REPLACEMENT =====================

    /**
     * 영상 교체 결과를 반영한다.
     *
     * <ul>
     *   <li>PASS + 반영 가능(최신 교체 작업·미삭제·ACTIVE) + 결과 객체 존재 → 원자적 교체 후 COMPLETED.</li>
     *   <li>PASS + 반영 불가 → 새 영상 미적용, 작업만 COMPLETED로 종료(REPLACEMENT_SKIPPED, ACK).</li>
     *   <li>PASS + 결과 객체 없음 → DB 미변경(OBJECT_NOT_FOUND, PENDING 유지).</li>
     *   <li>FAIL → 기존 영상 유지, 작업 COMPLETED.</li>
     *   <li>FAILED → 기존 영상 유지, 작업 FAILED.</li>
     * </ul>
     * 반영 여부와 무관하게 후보 원본·미적용 결과 객체는 커밋 이후 삭제 대상으로 등록한다.
     */
    private AiBlurResultOutcome applyReplacement(AiBlurJob job, AiBlurResultMessage message) {
        Pin pin = loadPin(job, message);

        return switch (message.processingStatus()) {
            case FAILED -> applyReplacementFailed(job, message);
            case COMPLETED -> switch (message.finalStatus()) {
                case FAIL -> applyReplacementFail(job, message);
                case PASS -> applyReplacementPass(pin, job, message);
            };
        };
    }

    private AiBlurResultOutcome applyReplacementPass(Pin pin, AiBlurJob job, AiBlurResultMessage message) {
        // 반영 가능 조건: 현재 작업이 이 Pin의 최신 영상 교체 작업이고, Pin이 삭제되지 않았으며 여전히 ACTIVE.
        // 만료 여부는 반영을 막지 않는다(요청 당시 미만료였고, AI 처리 중 만료돼도 최신 정상 결과면 반영한다).
        if (!isApplicable(pin, job)) {
            log.warn("영상 교체 PASS이지만 반영 불가(최신 아님·삭제·비ACTIVE). 작업만 종료한다 "
                            + "(requestId={}, pinId={}, videoStatus={}, deleted={})",
                    job.getRequestId(), pin.getId(), pin.getVideoStatus(), pin.getDeletedAt() != null);
            job.markCompleted(message.completedAt());
            runAfterCommit(() -> registerCandidateCleanup(job, message));
            return AiBlurResultOutcome.REPLACEMENT_SKIPPED;
        }

        if (!objectExists(message.blurredVideoKey()) || !objectExists(message.thumbnailKey())) {
            log.warn("영상 교체 PASS이지만 블러 영상·썸네일 객체를 확인할 수 없어 DB를 변경하지 않음 (requestId={})",
                    job.getRequestId());
            return AiBlurResultOutcome.OBJECT_NOT_FOUND;
        }

        // 기존 공개 영상 키를 보관했다가 커밋 이후 삭제 대상으로 등록한다.
        String previousOriginalKey = pin.getOriginalVideoKey();
        String previousBlurredKey = pin.getBlurredVideoKey();
        String previousThumbnailKey = pin.getThumbnailKey();

        // 공개 기준 시각은 메시지의 과거 시각이 아니라 Back이 결과를 반영하는 서버 시각이다.
        pin.replaceVideo(job.getOriginalVideoKey(), message.blurredVideoKey(),
                message.thumbnailKey(), clock.instant());
        job.markCompleted(message.completedAt());

        Long placeId = pin.getPlace().getId();
        runAfterCommit(() -> {
            videoObjectCleanupPort.registerForDeletion(previousOriginalKey);
            videoObjectCleanupPort.registerForDeletion(previousBlurredKey);
            videoObjectCleanupPort.registerForDeletion(previousThumbnailKey);
            placeScoreRecalculationPort.recalculate(placeId);
        });
        return AiBlurResultOutcome.APPLIED;
    }

    /**
     * 영상 교체 FAIL: 기존 공개 영상과 videoStatus=ACTIVE를 유지한다(REJECTED로 바꾸지 않는다).
     * 작업만 COMPLETED로 종료하고, 후보 원본·결과 객체를 삭제 대상으로 등록한다. 점수는 재계산하지 않는다.
     */
    private AiBlurResultOutcome applyReplacementFail(AiBlurJob job, AiBlurResultMessage message) {
        job.markCompleted(message.completedAt());
        runAfterCommit(() -> registerCandidateCleanup(job, message));
        return AiBlurResultOutcome.APPLIED;
    }

    /**
     * 영상 교체 FAILED: 기존 공개 영상과 videoStatus=ACTIVE를 유지한다(FAILED로 바꾸지 않는다).
     * 작업만 FAILED로 종료하고, 후보 원본·결과 객체를 삭제 대상으로 등록한다. 점수는 재계산하지 않는다.
     */
    private AiBlurResultOutcome applyReplacementFailed(AiBlurJob job, AiBlurResultMessage message) {
        job.markFailed(message.completedAt());
        runAfterCommit(() -> registerCandidateCleanup(job, message));
        return AiBlurResultOutcome.APPLIED;
    }

    /** 현재 작업이 최신 교체 작업이고 Pin이 삭제되지 않았으며 ACTIVE인지. */
    private boolean isApplicable(Pin pin, AiBlurJob job) {
        return isLatestReplacement(job)
                && pin.getDeletedAt() == null
                && pin.getVideoStatus() == VideoStatus.ACTIVE;
    }

    /** 이 작업이 해당 Pin의 가장 최근 영상 교체 작업인지 판정한다. */
    private boolean isLatestReplacement(AiBlurJob job) {
        return aiBlurJobRepository
                .findFirstByPinIdAndJobTypeOrderByCreatedAtDesc(job.getPinId(), AiBlurJobType.VIDEO_REPLACEMENT)
                .map(latest -> latest.getRequestId().equals(job.getRequestId()))
                .orElse(false);
    }

    /** 반영하지 않은 후보 원본과 AI 결과 객체(있으면)를 삭제 대상으로 등록한다. */
    private void registerCandidateCleanup(AiBlurJob job, AiBlurResultMessage message) {
        videoObjectCleanupPort.registerForDeletion(job.getOriginalVideoKey());
        videoObjectCleanupPort.registerForDeletion(message.blurredVideoKey());
        videoObjectCleanupPort.registerForDeletion(message.thumbnailKey());
    }

    // ===================== 공통 =====================

    /** 작업 pinId로 Pin을 조회한다. 메시지 pinId가 다르면 로그만 남긴다(추적용). */
    private Pin loadPin(AiBlurJob job, AiBlurResultMessage message) {
        if (!job.getPinId().equals(message.pinId())) {
            log.warn("메시지 pinId({})와 작업 pinId({})가 다르다. 작업 pinId를 기준으로 처리한다.",
                    message.pinId(), job.getPinId());
        }
        return pinRepository.findById(job.getPinId())
                .orElseThrow(() -> new CustomException(ErrorCode.AI_BLUR_PIN_NOT_FOUND));
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

    /**
     * DB 커밋 이후 실행할 후속 처리를 등록한다(삭제 대상 등록·장소 점수 재계산).
     * 활성 트랜잭션이 없으면(단위 테스트 등) 즉시 실행한다.
     */
    private void runAfterCommit(Runnable action) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    action.run();
                }
            });
        } else {
            action.run();
        }
    }
}
