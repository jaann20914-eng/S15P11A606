package com.yuhan.wagglewaggle.domain.chat.repository;

import com.yuhan.wagglewaggle.domain.chat.entity.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
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

    /**
     * 특정 채팅방의 전체 메시지를 id 오름차순(=생성 순서)으로 조회한다(메시지 이력 조회용).
     */
    List<ChatMessage> findByChatRoom_IdOrderByIdAsc(Long roomId);

    /**
     * 여러 방의 마지막 메시지를 한 번에 조회한다(채팅방 목록의 최근 메시지 미리보기용).
     * 방마다 최대 id 메시지(=가장 최근 메시지)만 골라 로드해 목록 조회 시 N+1을 방지한다.
     * 메시지가 하나도 없는 방은 결과에 포함되지 않는다(호출부에서 null 처리).
     */
    @Query("""
            SELECT m FROM ChatMessage m
            WHERE m.id IN (
                SELECT MAX(m2.id) FROM ChatMessage m2
                WHERE m2.chatRoom.id IN :roomIds
                GROUP BY m2.chatRoom.id
            )
            """)
    List<ChatMessage> findLastMessagesByRoomIds(@Param("roomIds") Collection<Long> roomIds);

    /**
     * 여러 방에 대해 "상대방이 보낸 메시지" 중 최대 id를 방별로 조회한다(안읽음 여부 계산용).
     * 이 값이 현재 사용자의 last_read_message_id보다 크면 읽지 않은 상대 메시지가 존재한다.
     * 상대 메시지가 없는 방은 결과에 포함되지 않는다.
     */
    @Query("""
            SELECT m.chatRoom.id AS roomId, MAX(m.id) AS maxOtherMessageId
            FROM ChatMessage m
            WHERE m.chatRoom.id IN :roomIds
              AND m.sender.id <> :memberId
            GROUP BY m.chatRoom.id
            """)
    List<RoomOtherMessageId> findMaxOtherSenderMessageIds(
            @Param("roomIds") Collection<Long> roomIds,
            @Param("memberId") Long memberId
    );

    /** 방별 상대방 발신 최대 메시지 id 투영. */
    interface RoomOtherMessageId {
        Long getRoomId();

        Long getMaxOtherMessageId();
    }
}
