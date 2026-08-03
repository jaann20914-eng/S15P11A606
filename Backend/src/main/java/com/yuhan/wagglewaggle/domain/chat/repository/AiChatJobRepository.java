package com.yuhan.wagglewaggle.domain.chat.repository;

import com.yuhan.wagglewaggle.domain.chat.entity.AiChatJob;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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
}
