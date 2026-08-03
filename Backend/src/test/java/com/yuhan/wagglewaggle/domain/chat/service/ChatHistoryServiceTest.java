package com.yuhan.wagglewaggle.domain.chat.service;

import com.yuhan.wagglewaggle.domain.chat.dto.ChatMessagesHistoryResponse;
import com.yuhan.wagglewaggle.domain.chat.dto.ChatMessagesHistoryResponse.MessageSender;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatMessage;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoom;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoomStatus;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatWarning;
import com.yuhan.wagglewaggle.domain.chat.entity.WarningReasonCode;
import com.yuhan.wagglewaggle.domain.chat.repository.ChatMessageRepository;
import com.yuhan.wagglewaggle.domain.chat.repository.ChatRoomRepository;
import com.yuhan.wagglewaggle.domain.chat.repository.ChatWarningRepository;
import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import com.yuhan.wagglewaggle.domain.place.entity.Place;
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

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class ChatHistoryServiceTest {

    @Mock private ChatRoomRepository chatRoomRepository;
    @Mock private ChatMessageRepository chatMessageRepository;
    @Mock private ChatWarningRepository chatWarningRepository;

    private ChatHistoryService service;

    private static final Long ROOM_ID = 1L;
    private static final Long REQUESTER_ID = 10L;
    private static final Long RECIPIENT_ID = 20L;

    @BeforeEach
    void setUp() {
        service = new ChatHistoryService(chatRoomRepository, chatMessageRepository, chatWarningRepository);
    }

    private Member member(Long id, String nickname, BigDecimal viewAngle) {
        Member m = mock(Member.class);
        lenient().when(m.getId()).thenReturn(id);
        lenient().when(m.getNickname()).thenReturn(nickname);
        lenient().when(m.getViewAngle()).thenReturn(viewAngle);
        return m;
    }

    private ChatRoom room(ChatRoomStatus status, Member requester, Member recipient,
                          String placeName, String address) {
        Place place = mock(Place.class);
        lenient().when(place.getName()).thenReturn(placeName);
        lenient().when(place.getAddressName()).thenReturn(address);
        Pin pin = mock(Pin.class);
        lenient().when(pin.getPlace()).thenReturn(place);
        ChatRoom room = mock(ChatRoom.class);
        lenient().when(room.getStatus()).thenReturn(status);
        lenient().when(room.getPin()).thenReturn(pin);
        lenient().when(room.getRequester()).thenReturn(requester);
        lenient().when(room.getRecipient()).thenReturn(recipient);
        return room;
    }

    private ChatMessage message(Long id, Member sender, String content, String maskedContent, Instant createdAt) {
        ChatMessage m = ChatMessage.create(mock(ChatRoom.class), sender, UUID.randomUUID(), content, maskedContent);
        ReflectionTestUtils.setField(m, "id", id);
        ReflectionTestUtils.setField(m, "createdAt", createdAt);
        return m;
    }

    private ChatWarning warning(Long id, WarningReasonCode reasonCode, Instant createdAt) {
        ChatWarning w = ChatWarning.create(mock(ChatRoom.class), reasonCode);
        ReflectionTestUtils.setField(w, "id", id);
        ReflectionTestUtils.setField(w, "createdAt", createdAt);
        return w;
    }

    @Test
    @DisplayName("참여자(요청자)가 조회하면 방 정보와 메시지·경고를 매핑해 반환한다")
    void 참여자가_조회하면_방정보와_메시지_경고를_매핑해_반환한다() {
        Member requester = member(REQUESTER_ID, "나", BigDecimal.valueOf(90));
        Member recipient = member(RECIPIENT_ID, "도장깨기 준호", BigDecimal.valueOf(92));
        ChatRoom room = room(ChatRoomStatus.ACTIVE, requester, recipient, "카페 A", "서울특별시 강남구 테헤란로 123");
        Instant t = Instant.parse("2026-07-23T12:00:00Z");

        given(chatRoomRepository.findDetailById(ROOM_ID)).willReturn(Optional.of(room));
        given(chatMessageRepository.findByChatRoom_IdOrderByIdAsc(ROOM_ID)).willReturn(List.of(
                message(1L, requester, "안녕하세요", null, t),
                message(2L, recipient, "반갑습니다 시발", "반갑습니다 **", t.plusSeconds(1))
        ));
        given(chatWarningRepository.findByChatRoom_IdOrderByIdAsc(ROOM_ID)).willReturn(List.of(
                warning(5L, WarningReasonCode.FRAUD_SCAM, t.plusSeconds(2))
        ));

        ChatMessagesHistoryResponse response = service.getHistory(REQUESTER_ID, ROOM_ID);

        assertThat(response.status()).isEqualTo(ChatRoomStatus.ACTIVE);
        assertThat(response.placeName()).isEqualTo("카페 A");
        assertThat(response.address()).isEqualTo("서울특별시 강남구 테헤란로 123");
        assertThat(response.otherUserNickname()).isEqualTo("도장깨기 준호");
        assertThat(response.otherUserViewTemperature()).isEqualByComparingTo(BigDecimal.valueOf(92));

        assertThat(response.messages()).hasSize(2);
        // 내가 보낸 메시지는 SELF, 마스킹 대상이 없으면 maskedContent는 원문과 동일하다.
        assertThat(response.messages().get(0).messageId()).isEqualTo(1L);
        assertThat(response.messages().get(0).sender()).isEqualTo(MessageSender.SELF);
        assertThat(response.messages().get(0).content()).isEqualTo("안녕하세요");
        assertThat(response.messages().get(0).maskedContent()).isEqualTo("안녕하세요");
        // 상대가 보낸 메시지는 OTHER, maskedContent는 필터가 적용된 값을 그대로 반환한다.
        assertThat(response.messages().get(1).sender()).isEqualTo(MessageSender.OTHER);
        assertThat(response.messages().get(1).content()).isEqualTo("반갑습니다 시발");
        assertThat(response.messages().get(1).maskedContent()).isEqualTo("반갑습니다 **");

        assertThat(response.warnings()).hasSize(1);
        assertThat(response.warnings().get(0).messageId()).isEqualTo(5L);
        assertThat(response.warnings().get(0).reasonCode()).isEqualTo(WarningReasonCode.FRAUD_SCAM);
        assertThat(response.warnings().get(0).content()).isEqualTo(WarningReasonCode.FRAUD_SCAM.getMessage());
    }

    @Test
    @DisplayName("수신자 시점에서는 발신자 구분(SELF/OTHER)이 반대로 매핑된다")
    void 수신자_시점에서는_발신자_구분이_반대로_매핑된다() {
        Member requester = member(REQUESTER_ID, "요청자", BigDecimal.valueOf(90));
        Member recipient = member(RECIPIENT_ID, "수신자", BigDecimal.valueOf(120));
        ChatRoom room = room(ChatRoomStatus.ACTIVE, requester, recipient, "카페 A", "주소");
        Instant t = Instant.parse("2026-07-23T12:00:00Z");

        given(chatRoomRepository.findDetailById(ROOM_ID)).willReturn(Optional.of(room));
        given(chatMessageRepository.findByChatRoom_IdOrderByIdAsc(ROOM_ID)).willReturn(List.of(
                message(1L, requester, "요청자 메시지", null, t),
                message(2L, recipient, "수신자 메시지", null, t.plusSeconds(1))
        ));
        given(chatWarningRepository.findByChatRoom_IdOrderByIdAsc(ROOM_ID)).willReturn(List.of());

        ChatMessagesHistoryResponse response = service.getHistory(RECIPIENT_ID, ROOM_ID);

        // 수신자가 조회하면 상대방은 요청자다.
        assertThat(response.otherUserNickname()).isEqualTo("요청자");
        assertThat(response.messages().get(0).sender()).isEqualTo(MessageSender.OTHER);
        assertThat(response.messages().get(1).sender()).isEqualTo(MessageSender.SELF);
    }

    @Test
    @DisplayName("채팅방이 존재하지 않으면 CHAT_ROOM_NOT_FOUND이며 메시지·경고를 조회하지 않는다")
    void 존재하지_않는_방이면_CHAT_ROOM_NOT_FOUND_예외() {
        given(chatRoomRepository.findDetailById(ROOM_ID)).willReturn(Optional.empty());

        assertThatThrownBy(() -> service.getHistory(REQUESTER_ID, ROOM_ID))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CHAT_ROOM_NOT_FOUND);
        verifyNoInteractions(chatMessageRepository, chatWarningRepository);
    }

    @Test
    @DisplayName("참여자가 아니면 CHAT_ROOM_ACCESS_DENIED이며 메시지·경고를 조회하지 않는다")
    void 참여자가_아니면_CHAT_ROOM_ACCESS_DENIED_예외() {
        Member requester = member(REQUESTER_ID, "요청자", BigDecimal.valueOf(90));
        Member recipient = member(RECIPIENT_ID, "수신자", BigDecimal.valueOf(90));
        ChatRoom room = room(ChatRoomStatus.ACTIVE, requester, recipient, "카페 A", "주소");
        given(chatRoomRepository.findDetailById(ROOM_ID)).willReturn(Optional.of(room));

        Long strangerId = 999L;
        assertThatThrownBy(() -> service.getHistory(strangerId, ROOM_ID))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CHAT_ROOM_ACCESS_DENIED);
        verifyNoInteractions(chatMessageRepository, chatWarningRepository);
    }

    @Test
    @DisplayName("메시지와 경고가 없으면 빈 배열을 반환한다")
    void 메시지와_경고가_없으면_빈_배열을_반환한다() {
        Member requester = member(REQUESTER_ID, "요청자", BigDecimal.valueOf(90));
        Member recipient = member(RECIPIENT_ID, "수신자", BigDecimal.valueOf(90));
        ChatRoom room = room(ChatRoomStatus.PENDING, requester, recipient, "카페 A", "주소");

        given(chatRoomRepository.findDetailById(ROOM_ID)).willReturn(Optional.of(room));
        given(chatMessageRepository.findByChatRoom_IdOrderByIdAsc(ROOM_ID)).willReturn(List.of());
        given(chatWarningRepository.findByChatRoom_IdOrderByIdAsc(ROOM_ID)).willReturn(List.of());

        ChatMessagesHistoryResponse response = service.getHistory(REQUESTER_ID, ROOM_ID);

        assertThat(response.status()).isEqualTo(ChatRoomStatus.PENDING);
        assertThat(response.messages()).isEmpty();
        assertThat(response.warnings()).isEmpty();
    }
}
