package com.yuhan.wagglewaggle.domain.chat.repository;

import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoom;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoomStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ChatRoomRepository extends JpaRepository<ChatRoom, Long> {

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
}
