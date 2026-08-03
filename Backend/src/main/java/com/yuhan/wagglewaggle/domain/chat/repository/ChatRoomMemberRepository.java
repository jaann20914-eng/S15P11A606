package com.yuhan.wagglewaggle.domain.chat.repository;

import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoomMember;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ChatRoomMemberRepository extends JpaRepository<ChatRoomMember, Long> {

    /**
     * 채팅방 id와 회원 id로 참여 멤버 행을 조회한다. 읽음 위치 갱신 시 대상 행을 로드하는 데 사용한다.
     */
    Optional<ChatRoomMember> findByChatRoom_IdAndMember_Id(Long roomId, Long memberId);
}
