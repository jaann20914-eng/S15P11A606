package com.yuhan.wagglewaggle.domain.chat.repository;

import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoom;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoomStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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
}
