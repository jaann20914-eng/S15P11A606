package com.yuhan.wagglewaggle.domain.chat.repository;

import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoomMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ChatRoomMemberRepository extends JpaRepository<ChatRoomMember, Long> {

    /**
     * 채팅방 id와 회원 id로 참여 멤버 행을 조회한다. 읽음 위치 갱신 시 대상 행을 로드하는 데 사용한다.
     */
    Optional<ChatRoomMember> findByChatRoom_IdAndMember_Id(Long roomId, Long memberId);

    /**
     * 여러 방에 대한 현재 사용자의 읽음 포인터(last_read_message_id)를 한 번에 조회한다(안읽음 여부 계산용).
     * 참여 행이 없는 방(예: 미수락 PENDING 수신자)은 결과에 포함되지 않으며, 호출부에서 "읽은 적 없음"으로 처리한다.
     */
    @Query("""
            SELECT crm.chatRoom.id AS roomId, crm.lastReadMessageId AS lastReadMessageId
            FROM ChatRoomMember crm
            WHERE crm.chatRoom.id IN :roomIds
              AND crm.member.id = :memberId
            """)
    List<RoomReadPointer> findReadPointers(
            @Param("roomIds") Collection<Long> roomIds,
            @Param("memberId") Long memberId
    );

    /** 방별 현재 사용자의 읽음 포인터 투영. lastReadMessageId는 아직 읽은 적 없으면 null. */
    interface RoomReadPointer {
        Long getRoomId();

        Long getLastReadMessageId();
    }
}
