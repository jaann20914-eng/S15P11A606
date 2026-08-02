package com.yuhan.wagglewaggle.domain.chat.repository;

import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoom;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoomStatus;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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
