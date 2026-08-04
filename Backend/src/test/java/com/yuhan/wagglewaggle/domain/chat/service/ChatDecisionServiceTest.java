package com.yuhan.wagglewaggle.domain.chat.service;

import com.yuhan.wagglewaggle.domain.chat.dto.ChatDecisionRequest;
import com.yuhan.wagglewaggle.domain.chat.dto.ChatDecisionResponse;
import com.yuhan.wagglewaggle.domain.chat.dto.ChatRoomStatusChangedEvent;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoom;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoomMember;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoomStatus;
import com.yuhan.wagglewaggle.domain.chat.repository.ChatRoomMemberRepository;
import com.yuhan.wagglewaggle.domain.chat.repository.ChatRoomRepository;
import com.yuhan.wagglewaggle.domain.credit.entity.CreditTransaction;
import com.yuhan.wagglewaggle.domain.credit.entity.CreditTransactionType;
import com.yuhan.wagglewaggle.domain.credit.repository.CreditTransactionRepository;
import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import com.yuhan.wagglewaggle.domain.user.entity.AgeGroup;
import com.yuhan.wagglewaggle.domain.user.entity.Gender;
import com.yuhan.wagglewaggle.domain.user.entity.Member;
import com.yuhan.wagglewaggle.domain.user.repository.MemberRepository;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class ChatDecisionServiceTest {

    @Mock private ChatRoomRepository chatRoomRepository;
    @Mock private MemberRepository memberRepository;
    @Mock private CreditTransactionRepository creditTransactionRepository;
    @Mock private ChatRoomMemberRepository chatRoomMemberRepository;
    @Mock private SimpMessagingTemplate messagingTemplate;

    private ChatDecisionService service;

    private static final Long ROOM_ID = 1L;
    private static final Long REQUESTER_ID = 99L;
    private static final Long RECIPIENT_ID = 42L; // 요청 수신자 = 결정 주체
    private static final UUID PIN_ID = UUID.fromString("11111111-2222-3333-4444-555555555555");
    private static final int ACCEPT_CREDIT = 5;
    private static final String USER_QUEUE = "/queue/chat-rooms";

    private static final Instant NOW = Instant.parse("2026-08-04T00:00:00Z");
    private final Clock clock = Clock.fixed(NOW, ZoneOffset.UTC);

    @BeforeEach
    void setUp() {
        service = new ChatDecisionService(
                chatRoomRepository, memberRepository, creditTransactionRepository, chatRoomMemberRepository,
                messagingTemplate, clock);
    }

    private ChatDecisionRequest req(String decision) {
        return new ChatDecisionRequest(decision);
    }

    private Member member(Long id, int creditBalance) {
        Member m = Member.create("nick" + id, AgeGroup.TWENTIES, Gender.MALE);
        ReflectionTestUtils.setField(m, "id", id);
        ReflectionTestUtils.setField(m, "creditBalance", creditBalance);
        return m;
    }

    /** PENDING 방을 잠금 조회하도록 준비한다. requester/recipient는 실제 Member로 세팅한다. */
    private ChatRoom givenPendingRoom(Member requester, Member recipient) {
        ChatRoom room = mock(ChatRoom.class);
        given(chatRoomRepository.findByIdForUpdate(ROOM_ID)).willReturn(Optional.of(room));
        given(room.getRecipient()).willReturn(recipient);
        given(room.getStatus()).willReturn(ChatRoomStatus.PENDING);
        return room;
    }

    /** 상태 변경 push가 참조하는 requester·pin을 스텁한다(발행까지 도달하는 흐름용). */
    private void givenRequesterAndPin(ChatRoom room, Member requester) {
        given(room.getRequester()).willReturn(requester);
        Pin pin = mock(Pin.class);
        given(pin.getId()).willReturn(PIN_ID);
        given(room.getPin()).willReturn(pin);
    }

    @Test
    @DisplayName("ACCEPT면 요청자 -5·수락자 +5 크레딧을 이동하고 거래 2건·수락자 멤버 1건을 생성한 뒤 ACTIVE로 전이하며 ACCEPTED를 반환한다")
    void ACCEPT면_크레딧을_이동하고_수락한다() {
        Member requester = member(REQUESTER_ID, 10);
        Member recipient = member(RECIPIENT_ID, 3);
        ChatRoom room = givenPendingRoom(requester, recipient);
        given(room.getRequester()).willReturn(requester);
        Pin pin = mock(Pin.class);
        given(pin.getId()).willReturn(PIN_ID);
        given(room.getPin()).willReturn(pin);
        given(memberRepository.findByIdForUpdate(REQUESTER_ID)).willReturn(Optional.of(requester));
        given(memberRepository.findByIdForUpdate(RECIPIENT_ID)).willReturn(Optional.of(recipient));

        ChatDecisionResponse response = service.decide(RECIPIENT_ID, ROOM_ID, req("ACCEPT"));

        assertThat(response.roomId()).isEqualTo(ROOM_ID);
        assertThat(response.status()).isEqualTo("ACCEPTED");
        // 실제 잔액 이동
        assertThat(requester.getCreditBalance()).isEqualTo(5);
        assertThat(recipient.getCreditBalance()).isEqualTo(8);
        // 상태 전이
        verify(room).accept();
        // 요청자 멤버 행은 방 생성 시점에 이미 만들어졌으므로 수락 시에는 수락자 멤버 1건만 생성한다.
        verify(chatRoomMemberRepository, times(1)).save(any(ChatRoomMember.class));

        // 거래 2건: 요청자 SENT(-5, after=5), 수락자 RECEIVED(+5, after=8)
        ArgumentCaptor<CreditTransaction> captor = ArgumentCaptor.forClass(CreditTransaction.class);
        verify(creditTransactionRepository, times(2)).save(captor.capture());
        List<CreditTransaction> saved = captor.getAllValues();

        CreditTransaction sent = saved.stream()
                .filter(t -> t.getType() == CreditTransactionType.SENT_CHAT_REQUEST_ACCEPTED)
                .findFirst().orElseThrow();
        assertThat(sent.getMemberId()).isEqualTo(REQUESTER_ID);
        assertThat(sent.getChangeAmount()).isEqualTo(-ACCEPT_CREDIT);
        assertThat(sent.getBalanceAfter()).isEqualTo(5);
        assertThat(sent.getPinId()).isEqualTo(PIN_ID);

        CreditTransaction received = saved.stream()
                .filter(t -> t.getType() == CreditTransactionType.RECEIVED_CHAT_REQUEST_ACCEPTED)
                .findFirst().orElseThrow();
        assertThat(received.getMemberId()).isEqualTo(RECIPIENT_ID);
        assertThat(received.getChangeAmount()).isEqualTo(ACCEPT_CREDIT);
        assertThat(received.getBalanceAfter()).isEqualTo(8);
        assertThat(received.getPinId()).isEqualTo(PIN_ID);

        // 상태 변경을 상대(요청자) 개인 큐로 push한다: status=ACTIVE, senderId=actor(수신자).
        ChatRoomStatusChangedEvent event = captureStatusEvent();
        assertThat(event.eventType()).isEqualTo("CHAT_ROOM_STATUS_CHANGED");
        assertThat(event.data().roomId()).isEqualTo(ROOM_ID);
        assertThat(event.data().pinId()).isEqualTo(PIN_ID);
        assertThat(event.data().senderId()).isEqualTo(RECIPIENT_ID);
        assertThat(event.data().status()).isEqualTo(ChatRoomStatus.ACTIVE);
        assertThat(event.data().changedAt()).isEqualTo(NOW);
        assertThat(event.occurredAt()).isEqualTo(NOW);
    }

    /** 요청자 개인 큐로 발행된 상태 변경 이벤트 1건을 캡처한다. */
    private ChatRoomStatusChangedEvent captureStatusEvent() {
        ArgumentCaptor<ChatRoomStatusChangedEvent> captor =
                ArgumentCaptor.forClass(ChatRoomStatusChangedEvent.class);
        verify(messagingTemplate).convertAndSendToUser(
                eq(String.valueOf(REQUESTER_ID)), eq(USER_QUEUE), captor.capture());
        return captor.getValue();
    }

    @Test
    @DisplayName("ACCEPT 시 데드락 방지를 위해 회원 행을 id 오름차순으로 잠근다")
    void ACCEPT면_회원행을_id_오름차순으로_잠근다() {
        Member requester = member(REQUESTER_ID, 10); // 99
        Member recipient = member(RECIPIENT_ID, 3);  // 42
        ChatRoom room = givenPendingRoom(requester, recipient);
        given(room.getRequester()).willReturn(requester);
        Pin pin = mock(Pin.class);
        given(pin.getId()).willReturn(PIN_ID);
        given(room.getPin()).willReturn(pin);
        given(memberRepository.findByIdForUpdate(REQUESTER_ID)).willReturn(Optional.of(requester));
        given(memberRepository.findByIdForUpdate(RECIPIENT_ID)).willReturn(Optional.of(recipient));

        service.decide(RECIPIENT_ID, ROOM_ID, req("ACCEPT"));

        InOrder order = inOrder(memberRepository);
        order.verify(memberRepository).findByIdForUpdate(RECIPIENT_ID); // 42 먼저
        order.verify(memberRepository).findByIdForUpdate(REQUESTER_ID); // 99 나중
    }

    @Test
    @DisplayName("REJECT면 REFUSED로 전이하고 크레딧·거래·멤버를 생성하지 않으며 REJECTED를 반환한다")
    void REJECT면_거절하고_크레딧을_건드리지_않는다() {
        Member requester = member(REQUESTER_ID, 10);
        Member recipient = member(RECIPIENT_ID, 3);
        ChatRoom room = givenPendingRoom(requester, recipient);
        givenRequesterAndPin(room, requester);

        ChatDecisionResponse response = service.decide(RECIPIENT_ID, ROOM_ID, req("REJECT"));

        assertThat(response.roomId()).isEqualTo(ROOM_ID);
        assertThat(response.status()).isEqualTo("REJECTED");
        verify(room).reject();
        verify(room, never()).accept();
        verify(memberRepository, never()).findByIdForUpdate(any());
        verifyNoInteractions(creditTransactionRepository, chatRoomMemberRepository);

        // 상태 변경(REFUSED)을 요청자 개인 큐로 push한다.
        assertThat(captureStatusEvent().data().status()).isEqualTo(ChatRoomStatus.REFUSED);
    }

    @Test
    @DisplayName("LEFT면 LEFT로 전이하고 크레딧·거래·멤버를 생성하지 않으며 LEFT를 반환한다")
    void LEFT면_나가고_크레딧을_건드리지_않는다() {
        Member requester = member(REQUESTER_ID, 10);
        Member recipient = member(RECIPIENT_ID, 3);
        ChatRoom room = givenPendingRoom(requester, recipient);
        givenRequesterAndPin(room, requester);

        ChatDecisionResponse response = service.decide(RECIPIENT_ID, ROOM_ID, req("LEFT"));

        assertThat(response.roomId()).isEqualTo(ROOM_ID);
        assertThat(response.status()).isEqualTo("LEFT");
        verify(room).leave();
        verify(memberRepository, never()).findByIdForUpdate(any());
        verifyNoInteractions(creditTransactionRepository, chatRoomMemberRepository);

        // 상태 변경(LEFT)을 요청자 개인 큐로 push한다.
        assertThat(captureStatusEvent().data().status()).isEqualTo(ChatRoomStatus.LEFT);
    }

    @Test
    @DisplayName("decision 값이 null이면 INVALID_CHAT_DECISION이며 채팅방을 조회하지 않는다")
    void decision이_null이면_INVALID_CHAT_DECISION() {
        assertThatThrownBy(() -> service.decide(RECIPIENT_ID, ROOM_ID, req(null)))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.INVALID_CHAT_DECISION);
        verifyNoInteractions(chatRoomRepository, memberRepository,
                creditTransactionRepository, chatRoomMemberRepository, messagingTemplate);
    }

    @Test
    @DisplayName("decision 값이 미허용 값이면 INVALID_CHAT_DECISION")
    void decision이_미허용값이면_INVALID_CHAT_DECISION() {
        assertThatThrownBy(() -> service.decide(RECIPIENT_ID, ROOM_ID, req("MAYBE")))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.INVALID_CHAT_DECISION);
        verifyNoInteractions(chatRoomRepository, messagingTemplate);
    }

    @Test
    @DisplayName("채팅방이 없으면 CHAT_REQUEST_NOT_FOUND")
    void 방이_없으면_CHAT_REQUEST_NOT_FOUND() {
        given(chatRoomRepository.findByIdForUpdate(ROOM_ID)).willReturn(Optional.empty());

        assertThatThrownBy(() -> service.decide(RECIPIENT_ID, ROOM_ID, req("ACCEPT")))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CHAT_REQUEST_NOT_FOUND);
        verifyNoInteractions(messagingTemplate);
    }

    @Test
    @DisplayName("요청 수신자가 아니면 CHAT_REQUEST_DECISION_FORBIDDEN이며 상태를 변경하지 않는다")
    void 수신자가_아니면_CHAT_REQUEST_DECISION_FORBIDDEN() {
        Member recipient = member(RECIPIENT_ID, 3);
        ChatRoom room = mock(ChatRoom.class);
        given(chatRoomRepository.findByIdForUpdate(ROOM_ID)).willReturn(Optional.of(room));
        given(room.getRecipient()).willReturn(recipient);
        Long otherMemberId = 777L;

        assertThatThrownBy(() -> service.decide(otherMemberId, ROOM_ID, req("ACCEPT")))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CHAT_REQUEST_DECISION_FORBIDDEN);
        verify(room, never()).accept();
        verifyNoInteractions(creditTransactionRepository, chatRoomMemberRepository, messagingTemplate);
    }

    @Test
    @DisplayName("이미 처리된 요청(PENDING 아님)이면 CHAT_REQUEST_ALREADY_DECIDED")
    void 이미_처리됐으면_CHAT_REQUEST_ALREADY_DECIDED() {
        Member recipient = member(RECIPIENT_ID, 3);
        ChatRoom room = mock(ChatRoom.class);
        given(chatRoomRepository.findByIdForUpdate(ROOM_ID)).willReturn(Optional.of(room));
        given(room.getRecipient()).willReturn(recipient);
        given(room.getStatus()).willReturn(ChatRoomStatus.ACTIVE);

        assertThatThrownBy(() -> service.decide(RECIPIENT_ID, ROOM_ID, req("ACCEPT")))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CHAT_REQUEST_ALREADY_DECIDED);
        verify(room, never()).accept();
        verifyNoInteractions(creditTransactionRepository, chatRoomMemberRepository, messagingTemplate);
    }

    @Test
    @DisplayName("ACCEPT 시 요청자 잔액이 부족하면 INSUFFICIENT_CREDIT이며 거래·멤버를 생성하지 않는다")
    void ACCEPT_잔액부족이면_INSUFFICIENT_CREDIT() {
        Member requester = member(REQUESTER_ID, 4); // < 5
        Member recipient = member(RECIPIENT_ID, 3);
        ChatRoom room = givenPendingRoom(requester, recipient);
        given(room.getRequester()).willReturn(requester);
        given(memberRepository.findByIdForUpdate(REQUESTER_ID)).willReturn(Optional.of(requester));
        given(memberRepository.findByIdForUpdate(RECIPIENT_ID)).willReturn(Optional.of(recipient));

        assertThatThrownBy(() -> service.decide(RECIPIENT_ID, ROOM_ID, req("ACCEPT")))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.INSUFFICIENT_CREDIT);

        assertThat(requester.getCreditBalance()).isEqualTo(4); // 미차감
        assertThat(recipient.getCreditBalance()).isEqualTo(3); // 미적립
        verify(room, never()).accept();
        verifyNoInteractions(creditTransactionRepository, chatRoomMemberRepository, messagingTemplate);
    }
}
