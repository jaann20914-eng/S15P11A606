package com.yuhan.wagglewaggle.domain.chat.service;

import com.yuhan.wagglewaggle.domain.chat.dto.ChatMessageCreatedEvent;
import com.yuhan.wagglewaggle.domain.chat.dto.ChatMessageSendRequest;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatMessage;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoom;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoomStatus;
import com.yuhan.wagglewaggle.domain.chat.filter.ProfanityFilter;
import com.yuhan.wagglewaggle.domain.chat.repository.ChatMessageRepository;
import com.yuhan.wagglewaggle.domain.chat.repository.ChatRoomRepository;
import com.yuhan.wagglewaggle.domain.user.entity.Member;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class ChatMessageServiceTest {

    @Mock private ChatRoomRepository chatRoomRepository;
    @Mock private ChatMessageRepository chatMessageRepository;
    @Mock private ProfanityFilter profanityFilter;
    @Mock private SimpMessagingTemplate messagingTemplate;

    private ChatMessageService service;

    private static final Long ROOM_ID = 1L;
    private static final Long REQUESTER_ID = 10L;
    private static final Long RECIPIENT_ID = 20L;
    private static final Long STRANGER_ID = 99L;
    private static final UUID CLIENT_MESSAGE_ID = UUID.fromString("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    private static final String TOPIC = "/topic/chat/rooms/" + ROOM_ID;

    private final Clock clock = Clock.fixed(Instant.parse("2026-08-03T00:00:00Z"), ZoneOffset.UTC);

    @BeforeEach
    void setUp() {
        service = new ChatMessageService(
                chatRoomRepository, chatMessageRepository, profanityFilter, messagingTemplate, clock);
    }

    private ChatMessageSendRequest req(String content) {
        return new ChatMessageSendRequest(content, CLIENT_MESSAGE_ID);
    }

    /** ACTIVE 방을 준비하고, 요청자·수신자 식별자를 스텁한다. */
    private ChatRoom givenActiveRoom(boolean stubRequester, boolean stubRecipient) {
        ChatRoom room = mock(ChatRoom.class);
        given(chatRoomRepository.findById(ROOM_ID)).willReturn(Optional.of(room));
        given(room.getStatus()).willReturn(ChatRoomStatus.ACTIVE);
        if (stubRequester) {
            Member requester = mock(Member.class);
            given(requester.getId()).willReturn(REQUESTER_ID);
            given(room.getRequester()).willReturn(requester);
        }
        if (stubRecipient) {
            Member recipient = mock(Member.class);
            given(recipient.getId()).willReturn(RECIPIENT_ID);
            given(room.getRecipient()).willReturn(recipient);
        }
        return room;
    }

    @Test
    @DisplayName("참여자가 ACTIVE 방에 정상 전송하면 메시지를 저장하고 방 토픽에 브로드캐스트한다")
    void 정상_전송이면_저장하고_브로드캐스트한다() {
        givenActiveRoom(true, false); // 발신자 == 요청자 → 수신자 분기까지 가지 않음
        given(profanityFilter.mask("안녕하세요")).willReturn("안녕하세요");
        ChatMessage saved = mock(ChatMessage.class);
        given(saved.getId()).willReturn(500L);
        given(saved.getContent()).willReturn("안녕하세요");
        given(saved.getMaskedContent()).willReturn("안녕하세요");
        given(saved.getCreatedAt()).willReturn(Instant.parse("2026-08-03T00:00:00Z"));
        given(chatMessageRepository.saveAndFlush(any(ChatMessage.class))).willReturn(saved);

        service.send(REQUESTER_ID, ROOM_ID, req("안녕하세요"));

        verify(chatMessageRepository).saveAndFlush(any(ChatMessage.class));
        verify(messagingTemplate).convertAndSend(eq(TOPIC), any(ChatMessageCreatedEvent.class));
    }

    @Test
    @DisplayName("욕설이 포함되면 마스킹된 maskedContent로 저장하고 이벤트에도 마스킹 결과를 싣는다")
    void 욕설이_있으면_마스킹해서_저장하고_브로드캐스트한다() {
        givenActiveRoom(true, false);
        String origin = "야 시발 안녕";
        String masked = "야 ** 안녕";
        given(profanityFilter.mask(origin)).willReturn(masked);
        ChatMessage saved = mock(ChatMessage.class);
        given(saved.getId()).willReturn(501L);
        given(saved.getContent()).willReturn(origin);
        given(saved.getMaskedContent()).willReturn(masked);
        given(saved.getCreatedAt()).willReturn(Instant.parse("2026-08-03T00:00:00Z"));
        given(chatMessageRepository.saveAndFlush(any(ChatMessage.class))).willReturn(saved);

        service.send(REQUESTER_ID, ROOM_ID, req(origin));

        // 저장되는 엔티티에 원문과 마스킹 결과가 각각 담기는지 확인한다.
        ArgumentCaptor<ChatMessage> captor = ArgumentCaptor.forClass(ChatMessage.class);
        verify(chatMessageRepository).saveAndFlush(captor.capture());
        assertThat(captor.getValue().getContent()).isEqualTo(origin);
        assertThat(captor.getValue().getMaskedContent()).isEqualTo(masked);

        // 브로드캐스트 이벤트에도 content(원문)와 maskedContent(마스킹)가 함께 실린다.
        ArgumentCaptor<ChatMessageCreatedEvent> eventCaptor = ArgumentCaptor.forClass(ChatMessageCreatedEvent.class);
        verify(messagingTemplate).convertAndSend(eq(TOPIC), eventCaptor.capture());
        assertThat(eventCaptor.getValue().data().content()).isEqualTo(origin);
        assertThat(eventCaptor.getValue().data().maskedContent()).isEqualTo(masked);
    }

    @Test
    @DisplayName("존재하지 않는 방이면 CHAT_ROOM_NOT_FOUND이며 저장·브로드캐스트하지 않는다")
    void 방이_없으면_CHAT_ROOM_NOT_FOUND() {
        given(chatRoomRepository.findById(ROOM_ID)).willReturn(Optional.empty());

        assertThatThrownBy(() -> service.send(REQUESTER_ID, ROOM_ID, req("hi")))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CHAT_ROOM_NOT_FOUND);
        verify(chatMessageRepository, never()).saveAndFlush(any());
        verifyNoInteractions(messagingTemplate);
    }

    @Test
    @DisplayName("PENDING 방에 요청자가 보내면(수락 전) 메시지를 저장하고 방 토픽에 브로드캐스트한다")
    void PENDING방에_요청자가_보내면_전송한다() {
        ChatRoom room = mock(ChatRoom.class);
        given(chatRoomRepository.findById(ROOM_ID)).willReturn(Optional.of(room));
        given(room.getStatus()).willReturn(ChatRoomStatus.PENDING);
        Member requester = mock(Member.class);
        given(requester.getId()).willReturn(REQUESTER_ID);
        given(room.getRequester()).willReturn(requester);
        given(profanityFilter.mask("hi")).willReturn("hi");
        ChatMessage saved = mock(ChatMessage.class);
        given(saved.getId()).willReturn(502L);
        given(saved.getContent()).willReturn("hi");
        given(saved.getMaskedContent()).willReturn("hi");
        given(saved.getCreatedAt()).willReturn(Instant.parse("2026-08-03T00:00:00Z"));
        given(chatMessageRepository.saveAndFlush(any(ChatMessage.class))).willReturn(saved);

        service.send(REQUESTER_ID, ROOM_ID, req("hi"));

        verify(chatMessageRepository).saveAndFlush(any(ChatMessage.class));
        verify(messagingTemplate).convertAndSend(eq(TOPIC), any(ChatMessageCreatedEvent.class));
    }

    @Test
    @DisplayName("PENDING 방에 수신자가 보내면(수락 전) CHAT_ROOM_NOT_ACTIVE이며 저장하지 않는다")
    void PENDING방에_수신자가_보내면_CHAT_ROOM_NOT_ACTIVE() {
        ChatRoom room = mock(ChatRoom.class);
        given(chatRoomRepository.findById(ROOM_ID)).willReturn(Optional.of(room));
        given(room.getStatus()).willReturn(ChatRoomStatus.PENDING);
        Member requester = mock(Member.class);
        given(requester.getId()).willReturn(REQUESTER_ID);
        given(room.getRequester()).willReturn(requester);

        assertThatThrownBy(() -> service.send(RECIPIENT_ID, ROOM_ID, req("hi")))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CHAT_ROOM_NOT_ACTIVE);
        verify(chatMessageRepository, never()).saveAndFlush(any());
        verifyNoInteractions(messagingTemplate);
    }

    @Test
    @DisplayName("종료된(LEFT) 방이면 참여자여도 CHAT_ROOM_NOT_ACTIVE이며 저장하지 않는다")
    void 종료된_방이면_CHAT_ROOM_NOT_ACTIVE() {
        ChatRoom room = mock(ChatRoom.class);
        given(chatRoomRepository.findById(ROOM_ID)).willReturn(Optional.of(room));
        given(room.getStatus()).willReturn(ChatRoomStatus.LEFT);

        assertThatThrownBy(() -> service.send(REQUESTER_ID, ROOM_ID, req("hi")))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CHAT_ROOM_NOT_ACTIVE);
        verify(chatMessageRepository, never()).saveAndFlush(any());
        verifyNoInteractions(messagingTemplate);
    }

    @Test
    @DisplayName("방 참여자가 아닌 사용자가 보내면 CHAT_MESSAGE_SEND_FORBIDDEN이며 저장하지 않는다")
    void 비참여자면_CHAT_MESSAGE_SEND_FORBIDDEN() {
        givenActiveRoom(true, true); // 요청자·수신자 어느 쪽도 아닌 발신자

        assertThatThrownBy(() -> service.send(STRANGER_ID, ROOM_ID, req("hi")))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CHAT_MESSAGE_SEND_FORBIDDEN);
        verify(chatMessageRepository, never()).saveAndFlush(any());
        verifyNoInteractions(messagingTemplate);
    }

    @Test
    @DisplayName("content가 공백이면 CHAT_MESSAGE_BLANK이며 방을 조회하지 않는다")
    void 공백_내용이면_CHAT_MESSAGE_BLANK() {
        assertThatThrownBy(() -> service.send(REQUESTER_ID, ROOM_ID, req("   ")))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CHAT_MESSAGE_BLANK);
        verifyNoInteractions(chatRoomRepository, chatMessageRepository, messagingTemplate);
    }

    @Test
    @DisplayName("content가 최대 길이를 초과하면 CHAT_MESSAGE_TOO_LONG이며 방을 조회하지 않는다")
    void 길이_초과면_CHAT_MESSAGE_TOO_LONG() {
        String tooLong = "a".repeat(ChatMessageService.MAX_CONTENT_LENGTH + 1);

        assertThatThrownBy(() -> service.send(REQUESTER_ID, ROOM_ID, req(tooLong)))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CHAT_MESSAGE_TOO_LONG);
        verifyNoInteractions(chatRoomRepository, chatMessageRepository, messagingTemplate);
    }

    @Test
    @DisplayName("client_message_id가 없으면 INVALID_REQUEST이며 방을 조회하지 않는다")
    void 멱등키가_없으면_INVALID_REQUEST() {
        ChatMessageSendRequest noKey = new ChatMessageSendRequest("hi", null);

        assertThatThrownBy(() -> service.send(REQUESTER_ID, ROOM_ID, noKey))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.INVALID_REQUEST);
        verifyNoInteractions(chatRoomRepository, chatMessageRepository, messagingTemplate);
    }

    @Test
    @DisplayName("동일 client_message_id 중복 전송은 유니크 위반을 멱등 처리해 재브로드캐스트하지 않는다")
    void 중복_전송이면_재브로드캐스트하지_않는다() {
        givenActiveRoom(true, false);
        given(profanityFilter.mask("hi")).willReturn("hi");
        given(chatMessageRepository.saveAndFlush(any(ChatMessage.class)))
                .willThrow(new DataIntegrityViolationException("duplicate"));

        service.send(REQUESTER_ID, ROOM_ID, req("hi"));

        verify(chatMessageRepository).saveAndFlush(any(ChatMessage.class));
        verifyNoInteractions(messagingTemplate);
    }
}
