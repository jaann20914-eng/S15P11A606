package com.yuhan.wagglewaggle.domain.chat.service;

import com.yuhan.wagglewaggle.domain.chat.dto.ChatRequestCreateRequest;
import com.yuhan.wagglewaggle.domain.chat.dto.ChatRequestCreateResponse;
import com.yuhan.wagglewaggle.domain.chat.dto.ChatRoomRequestedEvent;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoom;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoomMember;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoomStatus;
import com.yuhan.wagglewaggle.domain.chat.repository.ChatRoomMemberRepository;
import com.yuhan.wagglewaggle.domain.chat.repository.ChatRoomRepository;
import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import com.yuhan.wagglewaggle.domain.pin.repository.PinRepository;
import com.yuhan.wagglewaggle.domain.pin.repository.PinUnlockRepository;
import com.yuhan.wagglewaggle.domain.place.entity.Place;
import com.yuhan.wagglewaggle.domain.user.entity.Member;
import com.yuhan.wagglewaggle.domain.user.repository.MemberRepository;
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
class ChatRequestServiceTest {

    @Mock private PinRepository pinRepository;
    @Mock private PinUnlockRepository pinUnlockRepository;
    @Mock private ChatRoomRepository chatRoomRepository;
    @Mock private ChatRoomMemberRepository chatRoomMemberRepository;
    @Mock private MemberRepository memberRepository;
    @Mock private SimpMessagingTemplate messagingTemplate;

    private ChatRequestService service;

    private static final UUID PIN_ID = UUID.fromString("11111111-2222-3333-4444-555555555555");
    private static final Long REQUESTER_ID = 99L;
    private static final Long OWNER_ID = 42L;
    private static final String REQUESTER_NICKNAME = "도장깨기 준호";
    private static final String PLACE_NAME = "카페 A";
    private static final String USER_QUEUE = "/queue/chat-rooms";
    private static final Instant REQUESTED_AT = Instant.parse("2026-08-01T18:00:00Z");

    private static final Instant NOW = Instant.parse("2026-08-04T00:00:00Z");
    private final Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);

    @BeforeEach
    void setUp() {
        service = new ChatRequestService(
                pinRepository, pinUnlockRepository, chatRoomRepository, chatRoomMemberRepository, memberRepository,
                messagingTemplate, clock);
    }

    private ChatRequestCreateRequest req(String pinId) {
        return new ChatRequestCreateRequest(pinId);
    }

    /** 크레딧 게이트를 통과(또는 실패)하도록 요청자 로딩을 준비한다. */
    private Member givenRequesterWithCredit(int credit) {
        Member requester = mock(Member.class);
        given(requester.getCreditBalance()).willReturn(credit);
        given(memberRepository.findById(REQUESTER_ID)).willReturn(Optional.of(requester));
        return requester;
    }

    /** 활성·타인·구매·방없음 흐름을 만족하도록 pin/owner mock을 준비한다. */
    private Pin givenActivePinOwnedByOther() {
        Pin pin = mock(Pin.class);
        Member owner = mock(Member.class);
        given(pinRepository.findActivePinDetailById(eq(PIN_ID), any(Instant.class)))
                .willReturn(Optional.of(pin));
        given(pin.getMember()).willReturn(owner);
        given(owner.getId()).willReturn(OWNER_ID);
        return pin;
    }

    @Test
    @DisplayName("활성·타인 소유·구매 완료·방 없음이면 PENDING 채팅방과 요청자 멤버 행을 생성하고 roomId·pinId를 반환한다")
    void 유효한_요청이면_채팅방을_생성한다() {
        Member requester = givenRequesterWithCredit(10);
        given(requester.getNickname()).willReturn(REQUESTER_NICKNAME);
        Pin pin = givenActivePinOwnedByOther();
        given(pinUnlockRepository.existsByPin_IdAndMember_Id(PIN_ID, REQUESTER_ID)).willReturn(true);
        given(chatRoomRepository.findStatusByPinIdAndRequesterId(PIN_ID, REQUESTER_ID))
                .willReturn(Optional.empty());
        Place place = mock(Place.class);
        given(pin.getPlace()).willReturn(place);
        given(place.getName()).willReturn(PLACE_NAME);
        ChatRoom saved = mock(ChatRoom.class);
        given(saved.getId()).willReturn(1L);
        given(saved.getStatus()).willReturn(ChatRoomStatus.PENDING);
        given(saved.getCreatedAt()).willReturn(REQUESTED_AT);
        given(chatRoomRepository.saveAndFlush(any(ChatRoom.class))).willReturn(saved);

        ChatRequestCreateResponse response = service.request(REQUESTER_ID, req(PIN_ID.toString()));

        assertThat(response.roomId()).isEqualTo(1L);
        assertThat(response.pinId()).isEqualTo(PIN_ID);
        verify(chatRoomRepository).saveAndFlush(any(ChatRoom.class));
        // 수락 전에도 요청자가 전송할 수 있도록 요청자 멤버 행을 미리 생성한다.
        verify(chatRoomMemberRepository).save(any(ChatRoomMember.class));

        // 새 요청을 recipient(핀 소유자=OWNER_ID) 개인 큐로 push한다. 요청자에게는 보내지 않는다.
        ArgumentCaptor<ChatRoomRequestedEvent> captor = ArgumentCaptor.forClass(ChatRoomRequestedEvent.class);
        verify(messagingTemplate).convertAndSendToUser(
                eq(String.valueOf(OWNER_ID)), eq(USER_QUEUE), captor.capture());
        ChatRoomRequestedEvent event = captor.getValue();
        assertThat(event.eventType()).isEqualTo("CHAT_ROOM_REQUESTED");
        assertThat(event.occurredAt()).isEqualTo(NOW);
        assertThat(event.data().roomId()).isEqualTo(1L);
        assertThat(event.data().requesterId()).isEqualTo(REQUESTER_ID);
        assertThat(event.data().requesterNickname()).isEqualTo(REQUESTER_NICKNAME);
        assertThat(event.data().pinId()).isEqualTo(PIN_ID);
        assertThat(event.data().placeName()).isEqualTo(PLACE_NAME);
        assertThat(event.data().status()).isEqualTo(ChatRoomStatus.PENDING);
        assertThat(event.data().requestedAt()).isEqualTo(REQUESTED_AT);
    }

    @Test
    @DisplayName("pinId가 null이면 INVALID_PIN_ID이며 핀을 조회하지 않는다")
    void pinId가_null이면_INVALID_PIN_ID() {
        assertThatThrownBy(() -> service.request(REQUESTER_ID, req(null)))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.INVALID_PIN_ID);
        verifyNoInteractions(pinRepository, pinUnlockRepository, chatRoomRepository,
                chatRoomMemberRepository, memberRepository);
    }

    @Test
    @DisplayName("request 자체가 null이면 INVALID_PIN_ID")
    void request가_null이면_INVALID_PIN_ID() {
        assertThatThrownBy(() -> service.request(REQUESTER_ID, null))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.INVALID_PIN_ID);
    }

    @Test
    @DisplayName("pinId가 UUID 형식이 아니면 INVALID_PIN_ID")
    void pinId가_형식오류면_INVALID_PIN_ID() {
        assertThatThrownBy(() -> service.request(REQUESTER_ID, req("not-a-uuid")))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.INVALID_PIN_ID);
    }

    @Test
    @DisplayName("활성 핀이 없으면 PIN_NOT_FOUND")
    void 활성핀이_없으면_PIN_NOT_FOUND() {
        givenRequesterWithCredit(10);
        given(pinRepository.findActivePinDetailById(eq(PIN_ID), any(Instant.class)))
                .willReturn(Optional.empty());

        assertThatThrownBy(() -> service.request(REQUESTER_ID, req(PIN_ID.toString())))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.PIN_NOT_FOUND);
    }

    @Test
    @DisplayName("본인 핀에 요청하면 CHAT_REQUEST_FORBIDDEN이며 구매 여부를 확인하지 않는다")
    void 본인핀이면_CHAT_REQUEST_FORBIDDEN() {
        givenRequesterWithCredit(10);
        Pin pin = mock(Pin.class);
        Member owner = mock(Member.class);
        given(pinRepository.findActivePinDetailById(eq(PIN_ID), any(Instant.class)))
                .willReturn(Optional.of(pin));
        given(pin.getMember()).willReturn(owner);
        given(owner.getId()).willReturn(REQUESTER_ID); // 요청자 == 소유자

        assertThatThrownBy(() -> service.request(REQUESTER_ID, req(PIN_ID.toString())))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CHAT_REQUEST_FORBIDDEN);
        verify(pinUnlockRepository, never()).existsByPin_IdAndMember_Id(any(), any());
    }

    @Test
    @DisplayName("구매하지 않았으면 CHAT_REQUEST_FORBIDDEN")
    void 미구매면_CHAT_REQUEST_FORBIDDEN() {
        givenRequesterWithCredit(10);
        givenActivePinOwnedByOther();
        given(pinUnlockRepository.existsByPin_IdAndMember_Id(PIN_ID, REQUESTER_ID)).willReturn(false);

        assertThatThrownBy(() -> service.request(REQUESTER_ID, req(PIN_ID.toString())))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CHAT_REQUEST_FORBIDDEN);
    }

    @Test
    @DisplayName("이미 채팅방이 존재하면(상태 불문) CHAT_REQUEST_ALREADY_EXISTS")
    void 방이_이미_있으면_CHAT_REQUEST_ALREADY_EXISTS() {
        givenRequesterWithCredit(10);
        givenActivePinOwnedByOther();
        given(pinUnlockRepository.existsByPin_IdAndMember_Id(PIN_ID, REQUESTER_ID)).willReturn(true);
        given(chatRoomRepository.findStatusByPinIdAndRequesterId(PIN_ID, REQUESTER_ID))
                .willReturn(Optional.of(ChatRoomStatus.REFUSED));

        assertThatThrownBy(() -> service.request(REQUESTER_ID, req(PIN_ID.toString())))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CHAT_REQUEST_ALREADY_EXISTS);
        verify(chatRoomRepository, never()).saveAndFlush(any());
        verifyNoInteractions(messagingTemplate);
    }

    @Test
    @DisplayName("저장 시 유니크 제약 위반(동시 요청 레이스)이면 CHAT_REQUEST_ALREADY_EXISTS")
    void 저장중_유니크위반이면_CHAT_REQUEST_ALREADY_EXISTS() {
        givenRequesterWithCredit(10);
        givenActivePinOwnedByOther();
        given(pinUnlockRepository.existsByPin_IdAndMember_Id(PIN_ID, REQUESTER_ID)).willReturn(true);
        given(chatRoomRepository.findStatusByPinIdAndRequesterId(PIN_ID, REQUESTER_ID))
                .willReturn(Optional.empty());
        given(chatRoomRepository.saveAndFlush(any(ChatRoom.class)))
                .willThrow(new DataIntegrityViolationException("duplicate"));

        assertThatThrownBy(() -> service.request(REQUESTER_ID, req(PIN_ID.toString())))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CHAT_REQUEST_ALREADY_EXISTS);
    }

    @Test
    @DisplayName("저장이 그 외 이유로 실패하면 CHAT_REQUEST_CREATE_FAILED")
    void 저장실패면_CHAT_REQUEST_CREATE_FAILED() {
        givenRequesterWithCredit(10);
        givenActivePinOwnedByOther();
        given(pinUnlockRepository.existsByPin_IdAndMember_Id(PIN_ID, REQUESTER_ID)).willReturn(true);
        given(chatRoomRepository.findStatusByPinIdAndRequesterId(PIN_ID, REQUESTER_ID))
                .willReturn(Optional.empty());
        given(chatRoomRepository.saveAndFlush(any(ChatRoom.class)))
                .willThrow(new RuntimeException("db down"));

        assertThatThrownBy(() -> service.request(REQUESTER_ID, req(PIN_ID.toString())))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CHAT_REQUEST_CREATE_FAILED);
    }

    @Test
    @DisplayName("요청자 크레딧이 5 미만이면 INSUFFICIENT_CREDIT이며 핀을 조회하지 않고 방을 생성하지 않는다")
    void 크레딧이_부족하면_INSUFFICIENT_CREDIT() {
        givenRequesterWithCredit(4); // < 5

        assertThatThrownBy(() -> service.request(REQUESTER_ID, req(PIN_ID.toString())))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.INSUFFICIENT_CREDIT);
        verify(pinRepository, never()).findActivePinDetailById(any(), any());
        verify(chatRoomRepository, never()).saveAndFlush(any());
        verifyNoInteractions(messagingTemplate);
    }
}
