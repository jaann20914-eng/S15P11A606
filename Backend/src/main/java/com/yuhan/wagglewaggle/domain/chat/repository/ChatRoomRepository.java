package com.yuhan.wagglewaggle.domain.chat.repository;

import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoom;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoomStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ChatRoomRepository extends JpaRepository<ChatRoom, Long> {

    /**
     * 채팅 요청 결정 트랜잭션용 단일 채팅방 조회(비관적 쓰기 잠금).
     * status 전이는 "PENDING 확인 후 변경"이라 check-then-act 경쟁 대상이므로, 이 행을 잠근 채 조회한다.
     * 동일 방에 대한 중복 결정(모바일 재전송)은 첫 요청이 커밋될 때까지 대기 후 이미 결정됨을 보게 되어
     * 멱등하게 처리된다. requester·recipient·pin은 지연 로딩 프록시로 접근하며(식별자만 사용),
     * 잠금 대상은 chat_rooms 행으로 한정한다.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT cr FROM ChatRoom cr WHERE cr.id = :id")
    Optional<ChatRoom> findByIdForUpdate(@Param("id") Long id);

    /**
     * 특정 핀에 속한 지정 상태의 채팅방을 조회한다(핀 삭제 시 ACTIVE 방 종료용).
     * 삭제 트랜잭션에서 조회한 ACTIVE 방만 CLOSED로 전환하고, 이미 종료·거절·나간 방은 대상에서 제외한다.
     */
    List<ChatRoom> findByPin_IdAndStatus(UUID pinId, ChatRoomStatus status);

    /**
     * 특정 핀에 속한 여러 상태의 채팅방을 조회한다(제보자 떠남 처리 시 PENDING·ACTIVE·REFUSED 방 일괄 종료용).
     * 떠남 트랜잭션에서 조회한 방만 LEFT로 전환하고, 이미 종료(LEFT)된 방은 대상에서 제외한다.
     */
    List<ChatRoom> findByPin_IdAndStatusIn(UUID pinId, Collection<ChatRoomStatus> statuses);

    /**
     * 현재 사용자가 요청자(requester)인, 해당 핀에 대한 채팅방 상태를 조회한다(핀 상세 채팅 상태 판정용).
     * chat_rooms의 (pin_id, requester_id) 유니크 제약으로 최대 1건이므로 다중 기록 우선순위 문제가 없다.
     * 엔티티를 로딩하지 않고 status만 SELECT 하며, 방이 없으면 빈 Optional(→ NONE으로 매핑)이다.
     */
    @Query("""
            SELECT cr.status FROM ChatRoom cr
            WHERE cr.pin.id = :pinId
              AND cr.requester.id = :requesterId
            """)
    Optional<ChatRoomStatus> findStatusByPinIdAndRequesterId(
            @Param("pinId") UUID pinId,
            @Param("requesterId") Long requesterId
    );

    /**
     * 해당 채팅방의 참여자(요청자 또는 수신자)가 지정 사용자인지 확인한다(실시간 구독 권한 검증용).
     * 참여자 행(ChatRoomMember)은 ACTIVE 수락 후 생성되므로, 상태와 무관하게 항상 존재하는
     * requester/recipient를 기준으로 판단해 PENDING 방의 정당한 참여자 구독도 허용한다.
     */
    @Query("""
            SELECT (COUNT(cr) > 0) FROM ChatRoom cr
            WHERE cr.id = :roomId
              AND (cr.requester.id = :memberId OR cr.recipient.id = :memberId)
            """)
    boolean existsByIdAndParticipant(@Param("roomId") Long roomId, @Param("memberId") Long memberId);

    /**
     * 지정 상태의 채팅방을 모두 조회한다(AI 2차 분석 배치 스케줄러의 ACTIVE 방 순회용).
     */
    List<ChatRoom> findAllByStatus(ChatRoomStatus status);

    /**
     * 메시지 이력 조회에 필요한 방·핀·장소·참여자를 한 번에 로드한다(fetch join으로 N+1 방지).
     * 상대방 닉네임·온도와 핀의 장소명·주소를 응답에 담기 위해 requester/recipient/pin/place를 함께 가져온다.
     */
    @Query("""
            SELECT cr FROM ChatRoom cr
            JOIN FETCH cr.pin p
            JOIN FETCH p.place
            JOIN FETCH cr.requester
            JOIN FETCH cr.recipient
            WHERE cr.id = :roomId
            """)
    Optional<ChatRoom> findDetailById(@Param("roomId") Long roomId);

    // ===== 내가 보낸(sent) 채팅방 목록(커서 페이지네이션) =====
    // 대상 = 현재 사용자가 요청자(requester)인 방 전부(PENDING·ACTIVE·REFUSED·LEFT 모두 포함).
    // 정렬 = 최근 활동 시각 DESC, roomId DESC. 최근 활동 시각 = 마지막 메시지 createdAt, 없으면 방 createdAt.
    //        (상관 서브쿼리 MAX(m.createdAt)를 COALESCE로 방 생성 시각으로 대체)
    // 응답용 상대방(recipient)·장소(pin→place)는 ToOne fetch join으로 N+1을 방지한다.
    // limit+1건을 조회해 다음 페이지 존재 여부를 판단한다(nextCursor 발급용).

    /**
     * 내가 보낸 채팅방의 첫 페이지를 조회한다(커서 없음).
     */
    @Query("""
            SELECT cr FROM ChatRoom cr
            JOIN FETCH cr.pin p
            JOIN FETCH p.place
            JOIN FETCH cr.recipient
            WHERE cr.requester.id = :requesterId
            ORDER BY COALESCE(
                         (SELECT MAX(m.createdAt) FROM ChatMessage m WHERE m.chatRoom = cr),
                         cr.createdAt) DESC,
                     cr.id DESC
            """)
    List<ChatRoom> findSentRoomsFirstPage(
            @Param("requesterId") Long requesterId,
            Pageable pageable
    );

    /**
     * 내가 보낸 채팅방의 커서 이후 페이지를 조회한다.
     * 정렬(최근 활동 시각 DESC, roomId DESC)과 동일한 타이브레이커로, 커서보다 "뒤"에 오는 방만 조회한다:
     * 최근 활동 시각이 더 이르거나, 같으면 roomId가 더 작은 방.
     */
    @Query("""
            SELECT cr FROM ChatRoom cr
            JOIN FETCH cr.pin p
            JOIN FETCH p.place
            JOIN FETCH cr.recipient
            WHERE cr.requester.id = :requesterId
              AND ( COALESCE((SELECT MAX(m.createdAt) FROM ChatMessage m WHERE m.chatRoom = cr), cr.createdAt) < :cursorActivityAt
                 OR ( COALESCE((SELECT MAX(m.createdAt) FROM ChatMessage m WHERE m.chatRoom = cr), cr.createdAt) = :cursorActivityAt
                      AND cr.id < :cursorRoomId ) )
            ORDER BY COALESCE(
                         (SELECT MAX(m.createdAt) FROM ChatMessage m WHERE m.chatRoom = cr),
                         cr.createdAt) DESC,
                     cr.id DESC
            """)
    List<ChatRoom> findSentRoomsAfterCursor(
            @Param("requesterId") Long requesterId,
            @Param("cursorActivityAt") Instant cursorActivityAt,
            @Param("cursorRoomId") Long cursorRoomId,
            Pageable pageable
    );
}
