package com.yuhan.wagglewaggle.domain.blur.repository;

import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJob;
import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJobStatus;
import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJobType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AiBlurJobRepository extends JpaRepository<AiBlurJob, UUID> {

    /**
     * 동일한 원본 영상 키가 이미 어떤 AI 작업에 사용되었는지 안전하게 검사한다.
     * DB의 UNIQUE(original_video_key) 제약과 함께 중복 생성을 방지한다.
     */
    boolean existsByOriginalVideoKey(String originalVideoKey);

    /**
     * 특정 핀의 AI 작업 이력을 최신순으로 조회한다(최초 등록·영상 교체 작업 포함).
     */
    List<AiBlurJob> findByPinIdOrderByCreatedAtDesc(UUID pinId);

    /**
     * 특정 핀에 지정한 유형·상태의 AI 작업이 존재하는지 검사한다.
     * 영상 교체 시 진행 중(PENDING) 교체 작업 중복 생성을 막는 데 사용한다.
     * (Pin 행 비관적 잠금과 함께 호출해 "핀당 PENDING 교체 1건" 불변식을 원자적으로 보장한다.)
     */
    boolean existsByPinIdAndJobTypeAndStatus(
            UUID pinId, AiBlurJobType jobType, AiBlurJobStatus status);

    /**
     * 특정 핀의 지정 유형(영상 교체) 작업 중 가장 최근에 생성된 1건을 조회한다.
     * 영상 교체 결과 반영 시 "현재 작업이 최신 교체 작업인지" 판정에 사용한다.
     */
    Optional<AiBlurJob> findFirstByPinIdAndJobTypeOrderByCreatedAtDesc(
            UUID pinId, AiBlurJobType jobType);

    /**
     * 재발행 대상 조회: 지정한 상태(예: PENDING)이면서 생성된 지 오래된 작업을
     * 오래된 순으로 조회한다. (status, created_at) 인덱스를 활용한다.
     */
    List<AiBlurJob> findByStatusAndCreatedAtLessThanOrderByCreatedAtAsc(
            AiBlurJobStatus status, Instant createdAtThreshold);

    /**
     * 특정 핀의 지정 상태 작업을 조회한다. 핀 삭제 시 PENDING 작업의 후보 원본 영상 키를
     * 스토리지 정리 대상으로 등록하는 데 사용한다(INITIAL_UPLOAD·VIDEO_REPLACEMENT 모두 포함).
     */
    List<AiBlurJob> findByPinIdAndStatus(UUID pinId, AiBlurJobStatus status);
}
