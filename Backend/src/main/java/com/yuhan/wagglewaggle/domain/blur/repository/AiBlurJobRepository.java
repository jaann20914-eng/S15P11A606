package com.yuhan.wagglewaggle.domain.blur.repository;

import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJob;
import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJobStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
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
     * 재발행 대상 조회: 지정한 상태(예: PENDING)이면서 생성된 지 오래된 작업을
     * 오래된 순으로 조회한다. (status, created_at) 인덱스를 활용한다.
     */
    List<AiBlurJob> findByStatusAndCreatedAtLessThanOrderByCreatedAtAsc(
            AiBlurJobStatus status, Instant createdAtThreshold);
}
