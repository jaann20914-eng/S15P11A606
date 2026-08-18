package com.yuhan.wagglewaggle.domain.blur.entity;

import com.yuhan.wagglewaggle.domain.blur.message.FinalStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

/**
 * AI 블러 처리 작업. 비동기 핀 등록 흐름에서 원본 영상 1건에 대한 블러 작업 1건을 저장한다.
 * pin_id는 핀 참조용 raw FK 값으로 보관한다(pins FK 존재, 양방향 연관관계 미사용).
 * 하나의 핀에 최초 등록(INITIAL_UPLOAD)과 이후 영상 교체(VIDEO_REPLACEMENT) 작업이 여러 개 생길 수 있어
 * pin_id에는 UNIQUE 제약을 두지 않는다. 반면 original_video_key는 작업 간 재사용을 막기 위해 UNIQUE다.
 */
@Getter
@Entity
@Table(name = "ai_blur_jobs")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class AiBlurJob {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "request_id")
    private UUID requestId;

    @Column(name = "pin_id", nullable = false)
    private UUID pinId;

    @Column(name = "original_video_key", nullable = false, length = 1024)
    private String originalVideoKey;

    @Enumerated(EnumType.STRING)
    @Column(name = "job_type", nullable = false)
    private AiBlurJobType jobType;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private AiBlurJobStatus status;

    // 최종 판정 결과. PASS/FAIL 로 COMPLETED 된 경우에만 저장하고, FAILED·PENDING 은 null 이다.
    // 동일 requestId 결과 재도착 시 정상 중복(같은 결과)과 충돌(다른 결과)을 구분하는 데 사용한다.
    @Enumerated(EnumType.STRING)
    @Column(name = "final_status")
    private FinalStatus finalStatus;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    /** 같은 작업을 동시에 수정하면 먼저 커밋한 요청만 성공하도록 충돌을 감지한다. */
    @Version
    @Column(name = "version", nullable = false)
    private Long version;

    private AiBlurJob(UUID pinId, String originalVideoKey, AiBlurJobType jobType) {
        this.pinId = pinId;
        this.originalVideoKey = originalVideoKey;
        this.jobType = jobType;
        this.status = AiBlurJobStatus.PENDING;
    }

    /**
     * 새 AI 블러 작업을 생성한다. 상태는 항상 PENDING으로 시작한다.
     * 최초 핀 등록은 INITIAL_UPLOAD, 이후 영상 교체는 VIDEO_REPLACEMENT를 전달한다.
     */
    public static AiBlurJob create(UUID pinId, String originalVideoKey, AiBlurJobType jobType) {
        return new AiBlurJob(pinId, originalVideoKey, jobType);
    }

    /**
     * 작업을 완료 처리한다. 상태를 COMPLETED로 바꾸고 완료 시각과 최종 판정 결과(PASS/FAIL)를 기록한다.
     * finalStatus는 결과 재도착 시 정상 중복과 충돌을 구분하는 데 사용한다.
     */
    public void markCompleted(Instant completedAt, FinalStatus finalStatus) {
        this.status = AiBlurJobStatus.COMPLETED;
        this.completedAt = completedAt;
        this.finalStatus = finalStatus;
    }

    /**
     * 작업을 실패 처리한다. 상태를 FAILED로 바꾸고 종료 시각을 기록한다.
     * 시스템 처리 실패(FAILED)는 status만으로 구분되므로 finalStatus는 null로 둔다.
     */
    public void markFailed(Instant completedAt) {
        this.status = AiBlurJobStatus.FAILED;
        this.completedAt = completedAt;
    }
}
