package com.yuhan.wagglewaggle.domain.chat.repository;

import com.yuhan.wagglewaggle.domain.chat.entity.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * 채팅 메시지 영속화 리포지토리.
 *
 * <p>멱등성은 {@code (sender_id, client_message_id)} 유니크 제약으로 보장하므로 별도 존재 조회 없이
 * 저장 시 {@code DataIntegrityViolationException}으로 중복을 판별한다.</p>
 */
public interface ChatMessageRepository extends JpaRepository<ChatMessage, Long> {

    /**
     * 특정 채팅방에서 주어진 id 이후(초과)의 메시지를 id 오름차순으로 조회한다.
     * AI 2차 분석 배치의 "미분석 구간"(방별 max end_message_id 이후) 수집에 사용한다.
     */
    List<ChatMessage> findByChatRoomIdAndIdGreaterThanOrderByIdAsc(Long roomId, Long afterId);

    /**
     * 주어진 메시지 id가 해당 채팅방에 속하는지 여부를 조회한다.
     * 읽음 위치 갱신 시 {@code lastReadMessageId}가 요청한 방의 메시지인지 검증하는 데 사용한다.
     */
    boolean existsByIdAndChatRoom_Id(Long messageId, Long roomId);
}
