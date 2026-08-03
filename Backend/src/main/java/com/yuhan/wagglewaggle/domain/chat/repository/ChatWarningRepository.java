package com.yuhan.wagglewaggle.domain.chat.repository;

import com.yuhan.wagglewaggle.domain.chat.entity.ChatWarning;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * 채팅 경고(chat_warnings) 영속화 리포지토리.
 */
public interface ChatWarningRepository extends JpaRepository<ChatWarning, Long> {

    /**
     * 특정 채팅방의 안전 경고를 id 오름차순(=생성 순서)으로 조회한다(메시지 이력 조회용).
     */
    List<ChatWarning> findByChatRoom_IdOrderByIdAsc(Long roomId);
}
