package com.yuhan.wagglewaggle.domain.chat.service;

import com.yuhan.wagglewaggle.domain.chat.dto.ChatReadRequest;
import com.yuhan.wagglewaggle.domain.chat.dto.ChatReadResponse;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoom;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoomMember;
import com.yuhan.wagglewaggle.domain.chat.repository.ChatMessageRepository;
import com.yuhan.wagglewaggle.domain.chat.repository.ChatRoomMemberRepository;
import com.yuhan.wagglewaggle.domain.chat.repository.ChatRoomRepository;
import com.yuhan.wagglewaggle.domain.user.entity.Member;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class ChatReadServiceTest {

    @Mock private ChatRoomRepository chatRoomRepository;
    @Mock private ChatMessageRepository chatMessageRepository;
    @Mock private ChatRoomMemberRepository chatRoomMemberRepository;

    private ChatReadService service;

    private static final Long ROOM_ID = 1L;
    private static final Long MEMBER_ID = 10L;

    @BeforeEach
    void setUp() {
        service = new ChatReadService(chatRoomRepository, chatMessageRepository, chatRoomMemberRepository);
    }

    private ChatReadRequest req(Long lastReadMessageId) {
        return new ChatReadRequest(lastReadMessageId);
    }

    /** 초기 읽음 위치를 가진 참여 멤버 행을 만든다. lastReadMessageId=null이면 아직 읽지 않은 상태다. */
    private ChatRoomMember memberWithLastRead(Long lastReadMessageId) {
        ChatRoomMember member = ChatRoomMember.create(mock(ChatRoom.class), mock(Member.class));
        ReflectionTestUtils.setField(member, "lastReadMessageId", lastReadMessageId);
        return member;
    }

    /** 방 존재·참여자·메시지 소속 검증을 모두 통과하도록 스텁하고, 대상 멤버 행을 반환하도록 준비한다. */
    private void givenAllChecksPass(ChatRoomMember member, Long messageId) {
        given(chatRoomRepository.existsById(ROOM_ID)).willReturn(true);
        given(chatRoomRepository.existsByIdAndParticipant(ROOM_ID, MEMBER_ID)).willReturn(true);
        given(chatMessageRepository.existsByIdAndChatRoom_Id(messageId, ROOM_ID)).willReturn(true);
        given(chatRoomMemberRepository.findByChatRoom_IdAndMember_Id(ROOM_ID, MEMBER_ID))
                .willReturn(Optional.of(member));
    }

    @Test
    @DisplayName("기존보다 큰 메시지 id면 읽음 위치를 갱신하고 갱신된 값을 반환한다")
    void 더_큰_id면_읽음위치를_갱신한다() {
        ChatRoomMember member = memberWithLastRead(100L);
        givenAllChecksPass(member, 104L);

        ChatReadResponse response = service.updateLastRead(MEMBER_ID, ROOM_ID, req(104L));

        assertThat(response.roomId()).isEqualTo(ROOM_ID);
        assertThat(response.lastReadMessageId()).isEqualTo(104L);
        assertThat(member.getLastReadMessageId()).isEqualTo(104L);
    }

    @Test
    @DisplayName("읽음 위치가 아직 없던(null) 경우에도 전달된 id로 갱신한다")
    void 기존값이_null이면_전달된_id로_갱신한다() {
        ChatRoomMember member = memberWithLastRead(null);
        givenAllChecksPass(member, 104L);

        ChatReadResponse response = service.updateLastRead(MEMBER_ID, ROOM_ID, req(104L));

        assertThat(response.lastReadMessageId()).isEqualTo(104L);
        assertThat(member.getLastReadMessageId()).isEqualTo(104L);
    }

    @Test
    @DisplayName("동일한 메시지 id를 반복 전달하면 값을 유지한 채 현재 값을 반환한다(멱등)")
    void 동일한_id면_값을_유지한다() {
        ChatRoomMember member = memberWithLastRead(104L);
        givenAllChecksPass(member, 104L);

        ChatReadResponse response = service.updateLastRead(MEMBER_ID, ROOM_ID, req(104L));

        assertThat(response.lastReadMessageId()).isEqualTo(104L);
        assertThat(member.getLastReadMessageId()).isEqualTo(104L);
    }

    @Test
    @DisplayName("기존보다 작은 메시지 id면 읽음 위치를 되돌리지 않고 기존 값을 반환한다")
    void 더_작은_id면_되돌리지_않는다() {
        ChatRoomMember member = memberWithLastRead(104L);
        givenAllChecksPass(member, 100L);

        ChatReadResponse response = service.updateLastRead(MEMBER_ID, ROOM_ID, req(100L));

        assertThat(response.lastReadMessageId()).isEqualTo(104L);
        assertThat(member.getLastReadMessageId()).isEqualTo(104L);
    }

    @Test
    @DisplayName("lastReadMessageId가 null이면 INVALID_MESSAGE_ID이며 어떤 조회도 하지 않는다")
    void 메시지id가_null이면_INVALID_MESSAGE_ID() {
        assertThatThrownBy(() -> service.updateLastRead(MEMBER_ID, ROOM_ID, req(null)))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.INVALID_MESSAGE_ID);
        verifyNoInteractions(chatRoomRepository, chatMessageRepository, chatRoomMemberRepository);
    }

    @Test
    @DisplayName("request 자체가 null이면 INVALID_MESSAGE_ID")
    void request가_null이면_INVALID_MESSAGE_ID() {
        assertThatThrownBy(() -> service.updateLastRead(MEMBER_ID, ROOM_ID, null))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.INVALID_MESSAGE_ID);
        verifyNoInteractions(chatRoomRepository, chatMessageRepository, chatRoomMemberRepository);
    }

    @Test
    @DisplayName("채팅방이 존재하지 않으면 CHAT_ROOM_NOT_FOUND이며 읽음 위치를 변경하지 않는다")
    void 방이_없으면_CHAT_ROOM_NOT_FOUND() {
        given(chatRoomRepository.existsById(ROOM_ID)).willReturn(false);

        assertThatThrownBy(() -> service.updateLastRead(MEMBER_ID, ROOM_ID, req(104L)))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CHAT_ROOM_NOT_FOUND);
        verifyNoInteractions(chatMessageRepository, chatRoomMemberRepository);
    }

    @Test
    @DisplayName("현재 사용자가 참여자가 아니면 CHAT_ROOM_ACCESS_DENIED이며 메시지를 조회하지 않는다")
    void 참여자가_아니면_CHAT_ROOM_ACCESS_DENIED() {
        given(chatRoomRepository.existsById(ROOM_ID)).willReturn(true);
        given(chatRoomRepository.existsByIdAndParticipant(ROOM_ID, MEMBER_ID)).willReturn(false);

        assertThatThrownBy(() -> service.updateLastRead(MEMBER_ID, ROOM_ID, req(104L)))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CHAT_ROOM_ACCESS_DENIED);
        verifyNoInteractions(chatMessageRepository, chatRoomMemberRepository);
    }

    @Test
    @DisplayName("지정한 메시지가 해당 채팅방에 속하지 않으면 CHAT_MESSAGE_NOT_FOUND이며 멤버 행을 조회하지 않는다")
    void 메시지가_방소속이_아니면_CHAT_MESSAGE_NOT_FOUND() {
        given(chatRoomRepository.existsById(ROOM_ID)).willReturn(true);
        given(chatRoomRepository.existsByIdAndParticipant(ROOM_ID, MEMBER_ID)).willReturn(true);
        given(chatMessageRepository.existsByIdAndChatRoom_Id(104L, ROOM_ID)).willReturn(false);

        assertThatThrownBy(() -> service.updateLastRead(MEMBER_ID, ROOM_ID, req(104L)))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CHAT_MESSAGE_NOT_FOUND);
        verifyNoInteractions(chatRoomMemberRepository);
    }
}
