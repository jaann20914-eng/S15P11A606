package com.yuhan.wagglewaggle.domain.chat.repository;

import com.yuhan.wagglewaggle.domain.chat.entity.AiChatJob;
import com.yuhan.wagglewaggle.domain.chat.entity.AiChatJobStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * AI 채팅 작업 영속화 리포지토리.
 * 미분석 판정을 위해 방별 이미 발행된 구간의 최대 end_message_id를 조회한다(상태와 무관).
 */
public interface AiChatJobRepository extends JpaRepository<AiChatJob, UUID> {

    /**
     * 해당 채팅방에 대해 이미 생성된 작업들의 최대 end_message_id를 조회한다.
     * 작업이 없으면 빈 Optional. 상태(PENDING/PROCESSING 등)와 무관하게 "이미 커버된 구간"을 판정한다.
     */
    @Query("SELECT MAX(j.endMessageId) FROM AiChatJob j WHERE j.chatRoomId = :roomId")
    Optional<Long> findMaxEndMessageIdByChatRoomId(@Param("roomId") Long roomId);

    /**
     * 재발행 대상 작업을 조회한다. 지정 상태(미완료: PENDING/PROCESSING/FAILED)이면서
     * 생성된 지 오래되어(created_at < staleBefore) 아직 결과를 못 받았고,
     * 포기 나이(created_at >= giveUpAfter)를 넘지 않은 작업만 대상으로 한다.
     */
    @Query("""
            SELECT j FROM AiChatJob j
            WHERE j.status IN :statuses
              AND j.createdAt < :staleBefore
              AND j.createdAt >= :giveUpAfter
            ORDER BY j.createdAt ASC
            """)
    List<AiChatJob> findRepublishTargets(
            @Param("statuses") Collection<AiChatJobStatus> statuses,
            @Param("staleBefore") Instant staleBefore,
            @Param("giveUpAfter") Instant giveUpAfter);

    /**
     * 재발행을 포기할 대상 작업을 조회한다. 지정 상태(PENDING/PROCESSING)이면서
     * 생성된 지 최대 재시도 나이를 넘긴(created_at < giveUpBefore) 작업을 FAILED로 마감하는 데 사용한다.
     */
    @Query("""
            SELECT j FROM AiChatJob j
            WHERE j.status IN :statuses
              AND j.createdAt < :giveUpBefore
            """)
    List<AiChatJob> findGiveUpTargets(
            @Param("statuses") Collection<AiChatJobStatus> statuses,
            @Param("giveUpBefore") Instant giveUpBefore);
}
