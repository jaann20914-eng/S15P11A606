package com.yuhan.wagglewaggle.domain.chat.service;

import com.yuhan.wagglewaggle.domain.chat.dto.ChatMessageCreatedEvent;
import com.yuhan.wagglewaggle.domain.chat.dto.ChatMessageSendRequest;
import com.yuhan.wagglewaggle.domain.chat.dto.ChatRoomUpdatedEvent;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatMessage;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoom;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoomStatus;
import com.yuhan.wagglewaggle.domain.chat.filter.ProfanityFilter;
import com.yuhan.wagglewaggle.domain.chat.repository.ChatMessageRepository;
import com.yuhan.wagglewaggle.domain.chat.repository.ChatRoomRepository;
import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
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
    private static final UUID PIN_ID = UUID.fromString("11111111-2222-3333-4444-555555555555");
    private static final String TOPIC = "/topic/chat/rooms/" + ROOM_ID;
    // convertAndSendToUser의 destination 인자(= /user prefix 제외). 구독 경로는 /user/queue/chat-rooms.
    private static final String USER_QUEUE = "/queue/chat-rooms";

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

    /**
     * 저장 성공 후 개인 큐 push까지 도달하는 흐름용. 방 토픽 브로드캐스트 이후 push 코드가
     * pin·요청자·수신자를 모두 참조하므로 세 프록시를 함께 스텁한다.
     */
    private ChatRoom givenActiveRoomForPush() {
        ChatRoom room = mock(ChatRoom.class);
        given(chatRoomRepository.findById(ROOM_ID)).willReturn(Optional.of(room));
        given(room.getStatus()).willReturn(ChatRoomStatus.ACTIVE);
        Member requester = mock(Member.class);
        given(requester.getId()).willReturn(REQUESTER_ID);
        given(room.getRequester()).willReturn(requester);
        Member recipient = mock(Member.class);
        given(recipient.getId()).willReturn(RECIPIENT_ID);
        given(room.getRecipient()).willReturn(recipient);
        Pin pin = mock(Pin.class);
        given(pin.getId()).willReturn(PIN_ID);
        given(room.getPin()).willReturn(pin);
        return room;
    }

    private ChatMessage savedMessage(Long id, String content, String maskedContent) {
        ChatMessage saved = mock(ChatMessage.class);
        given(saved.getId()).willReturn(id);
        given(saved.getContent()).willReturn(content);
        given(saved.getMaskedContent()).willReturn(maskedContent);
        given(saved.getCreatedAt()).willReturn(Instant.parse("2026-08-03T00:00:00Z"));
        return saved;
    }

    @Test
    @DisplayName("참여자가 ACTIVE 방에 정상 전송하면 저장·방 토픽 브로드캐스트와 상대 개인 큐 push를 수행한다")
    void 정상_전송이면_저장하고_브로드캐스트하고_상대_개인큐로_push한다() {
        givenActiveRoomForPush();
        given(profanityFilter.mask("안녕하세요")).willReturn("안녕하세요");
        ChatMessage saved = savedMessage(500L, "안녕하세요", "안녕하세요");
        given(chatMessageRepository.saveAndFlush(any(ChatMessage.class))).willReturn(saved);

        service.send(REQUESTER_ID, ROOM_ID, req("안녕하세요"));

        verify(chatMessageRepository).saveAndFlush(any(ChatMessage.class));
        verify(messagingTemplate).convertAndSend(eq(TOPIC), any(ChatMessageCreatedEvent.class));

        // 비발신자(상대=수신자) 개인 큐로 정확히 1회 push되고 payload가 기대값과 일치한다.
        ArgumentCaptor<ChatRoomUpdatedEvent> captor = ArgumentCaptor.forClass(ChatRoomUpdatedEvent.class);
        verify(messagingTemplate).convertAndSendToUser(
                eq(String.valueOf(RECIPIENT_ID)), eq(USER_QUEUE), captor.capture());
        ChatRoomUpdatedEvent event = captor.getValue();
        assertThat(event.eventType()).isEqualTo("CHAT_ROOM_UPDATED");
        assertThat(event.data().roomId()).isEqualTo(ROOM_ID);
        assertThat(event.data().pinId()).isEqualTo(PIN_ID);
        assertThat(event.data().senderId()).isEqualTo(REQUESTER_ID);
        assertThat(event.data().lastMessage()).isEqualTo("안녕하세요");
        assertThat(event.data().lastMessageAt()).isEqualTo(Instant.parse("2026-08-03T00:00:00Z"));
    }

    @Test
    @DisplayName("발신자 본인에게는 push하지 않고 비발신자(상대)에게만 push한다")
    void 발신자에게는_push하지_않는다() {
        givenActiveRoomForPush();
        given(profanityFilter.mask("hi")).willReturn("hi");
        ChatMessage saved = savedMessage(503L, "hi", "hi");
        given(chatMessageRepository.saveAndFlush(any(ChatMessage.class))).willReturn(saved);

        service.send(RECIPIENT_ID, ROOM_ID, req("hi"));

        // 발신자가 수신자이므로 비발신자인 요청자에게만 라우팅되고, senderId는 수신자 id로 담긴다.
        ArgumentCaptor<ChatRoomUpdatedEvent> captor = ArgumentCaptor.forClass(ChatRoomUpdatedEvent.class);
        verify(messagingTemplate).convertAndSendToUser(
                eq(String.valueOf(REQUESTER_ID)), eq(USER_QUEUE), captor.capture());
        assertThat(captor.getValue().data().senderId()).isEqualTo(RECIPIENT_ID);
        // 발신자(수신자) 개인 큐로는 push되지 않는다.
        verify(messagingTemplate, never()).convertAndSendToUser(
                eq(String.valueOf(RECIPIENT_ID)), eq(USER_QUEUE), any(ChatRoomUpdatedEvent.class));
    }

    @Test
    @DisplayName("욕설이 포함되면 마스킹된 maskedContent로 저장하고 이벤트에도 마스킹 결과를 싣는다")
    void 욕설이_있으면_마스킹해서_저장하고_브로드캐스트한다() {
        givenActiveRoomForPush();
        String origin = "야 시발 안녕";
        String masked = "야 ** 안녕";
        given(profanityFilter.mask(origin)).willReturn(masked);
        ChatMessage saved = savedMessage(501L, origin, masked);
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

        // 목록 미리보기(lastMessage)는 maskedContent(마스킹 결과)를 우선 사용한다.
        ArgumentCaptor<ChatRoomUpdatedEvent> listCaptor = ArgumentCaptor.forClass(ChatRoomUpdatedEvent.class);
        verify(messagingTemplate).convertAndSendToUser(
                eq(String.valueOf(RECIPIENT_ID)), eq(USER_QUEUE), listCaptor.capture());
        assertThat(listCaptor.getValue().data().lastMessage()).isEqualTo(masked);
    }

    @Test
    @DisplayName("maskedContent가 없으면 목록 미리보기(lastMessage)는 원문 content로 채운다")
    void 마스킹결과가_없으면_미리보기는_원문_content로_채운다() {
        givenActiveRoomForPush();
        given(profanityFilter.mask("원문내용")).willReturn("원문내용");
        ChatMessage saved = savedMessage(504L, "원문내용", null);
        given(chatMessageRepository.saveAndFlush(any(ChatMessage.class))).willReturn(saved);

        service.send(REQUESTER_ID, ROOM_ID, req("원문내용"));

        ArgumentCaptor<ChatRoomUpdatedEvent> listCaptor = ArgumentCaptor.forClass(ChatRoomUpdatedEvent.class);
        verify(messagingTemplate).convertAndSendToUser(
                eq(String.valueOf(RECIPIENT_ID)), eq(USER_QUEUE), listCaptor.capture());
        assertThat(listCaptor.getValue().data().lastMessage()).isEqualTo("원문내용");
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
        Member recipient = mock(Member.class);
        given(recipient.getId()).willReturn(RECIPIENT_ID);
        given(room.getRecipient()).willReturn(recipient);
        Pin pin = mock(Pin.class);
        given(pin.getId()).willReturn(PIN_ID);
        given(room.getPin()).willReturn(pin);
        given(profanityFilter.mask("hi")).willReturn("hi");
        ChatMessage saved = savedMessage(502L, "hi", "hi");
        given(chatMessageRepository.saveAndFlush(any(ChatMessage.class))).willReturn(saved);

        service.send(REQUESTER_ID, ROOM_ID, req("hi"));

        verify(chatMessageRepository).saveAndFlush(any(ChatMessage.class));
        verify(messagingTemplate).convertAndSend(eq(TOPIC), any(ChatMessageCreatedEvent.class));
        // 비발신자(상대=수신자)에게만 push된다.
        verify(messagingTemplate).convertAndSendToUser(
                eq(String.valueOf(RECIPIENT_ID)), eq(USER_QUEUE), any(ChatRoomUpdatedEvent.class));
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
