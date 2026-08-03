package com.yuhan.wagglewaggle.domain.chat.repository;

import com.yuhan.wagglewaggle.domain.chat.entity.ChatWarning;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 채팅 경고(chat_warnings) 영속화 리포지토리.
 */
public interface ChatWarningRepository extends JpaRepository<ChatWarning, Long> {
}
