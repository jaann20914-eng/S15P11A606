package com.yuhan.wagglewaggle.domain.chat.repository;

import com.yuhan.wagglewaggle.domain.chat.entity.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * 채팅 메시지 영속화 리포지토리.
 *
 * <p>멱등성은 {@code (sender_id, client_message_id)} 유니크 제약으로 보장하므로 별도 존재 조회 없이
 * 저장 시 {@code DataIntegrityViolationException}으로 중복을 판별한다.</p>
 */
public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {
}
