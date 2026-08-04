package com.yuhan.wagglewaggle.domain.chat.service;

import com.yuhan.wagglewaggle.domain.chat.dto.ChatRoomListItem;
import com.yuhan.wagglewaggle.domain.chat.dto.ChatRoomListResponse;
import com.yuhan.wagglewaggle.domain.chat.dto.ChatRoomSummaryStatus;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatMessage;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoom;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoomStatus;
import com.yuhan.wagglewaggle.domain.chat.repository.ChatMessageRepository;
import com.yuhan.wagglewaggle.domain.chat.repository.ChatMessageRepository.RoomOtherMessageId;
import com.yuhan.wagglewaggle.domain.chat.repository.ChatRoomMemberRepository;
import com.yuhan.wagglewaggle.domain.chat.repository.ChatRoomMemberRepository.RoomReadPointer;
import com.yuhan.wagglewaggle.domain.chat.repository.ChatRoomRepository;
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
import org.springframework.data.domain.PageRequest;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class ChatRoomListServiceTest {

    private static final Long MEMBER_ID = 900001L;

    @Mock private ChatRoomRepository chatRoomRepository;
    @Mock private ChatMessageRepository chatMessageRepository;
    @Mock private ChatRoomMemberRepository chatRoomMemberRepository;

    private ChatRoomListService service;

    @BeforeEach
    void setUp() {
        service = new ChatRoomListService(chatRoomRepository, chatMessageRepository, chatRoomMemberRepository);
    }

    @Test
    @DisplayName("커서 없이 조회하면 기본 limit(20)으로 첫 페이지를 조회하고 방 정보를 매핑한다")
    void 커서없이_조회하면_기본limit으로_첫페이지를_조회하고_방정보를_매핑한다() {
        Instant t1 = Instant.parse("2026-08-04T05:02:00Z");
        ChatRoom room1 = room(1L, ChatRoomStatus.ACTIVE, recipient("금쥐", BigDecimal.valueOf(92)),
                pinId(1), "카페 A", Instant.parse("2026-08-04T04:59:00Z"));
        ChatRoom room2 = room(2L, ChatRoomStatus.PENDING, recipient("카페탐험가", new BigDecimal("120.5")),
                pinId(2), "카페 B", Instant.parse("2026-08-04T03:59:00Z"));

        given(chatRoomRepository.findSentRoomsFirstPage(eq(MEMBER_ID), any())).willReturn(List.of(room1, room2));
        // room1만 메시지가 있고 room2는 메시지가 없다.
        ChatMessage msg1 = lastMessage(1L, "답변 감사합니다~", null, t1);
        given(chatMessageRepository.findLastMessagesByRoomIds(any())).willReturn(List.of(msg1));

        ChatRoomListResponse response = service.getMySentChatRooms(MEMBER_ID, null, null);

        assertThat(response.items()).hasSize(2);
        assertThat(response.nextCursor()).isNull();

        ChatRoomListItem i0 = response.items().get(0);
        assertThat(i0.roomId()).isEqualTo(1L);
        assertThat(i0.status()).isEqualTo(ChatRoomSummaryStatus.ACTIVE);
        assertThat(i0.pinId()).isEqualTo(pinId(1));
        assertThat(i0.placeName()).isEqualTo("카페 A");
        // sent 목록의 상대방은 항상 수신자(recipient)다.
        assertThat(i0.otherUserNickname()).isEqualTo("금쥐");
        assertThat(i0.otherUserViewAngle()).isEqualByComparingTo(BigDecimal.valueOf(92));
        assertThat(i0.lastMessage()).isEqualTo("답변 감사합니다~");
        assertThat(i0.lastMessageAt()).isEqualTo(t1);
        assertThat(i0.hasUnread()).isFalse();

        // 메시지가 없는 방은 lastMessage/lastMessageAt이 null이다.
        ChatRoomListItem i1 = response.items().get(1);
        assertThat(i1.roomId()).isEqualTo(2L);
        assertThat(i1.otherUserNickname()).isEqualTo("카페탐험가");
        assertThat(i1.lastMessage()).isNull();
        assertThat(i1.lastMessageAt()).isNull();
        assertThat(i1.hasUnread()).isFalse();

        // 기본 limit=20이므로 limit+1(21)건을 요청하고, 커서 이후 페이지는 조회하지 않는다.
        verify(chatRoomRepository).findSentRoomsFirstPage(MEMBER_ID, PageRequest.of(0, 21));
        verify(chatRoomRepository, never()).findSentRoomsAfterCursor(any(), any(), any(), any());
    }

    @Test
    @DisplayName("내부 상태 REFUSED·LEFT는 응답에서 CLOSED로 매핑한다")
    void 내부상태_REFUSED_LEFT는_CLOSED로_매핑한다() {
        ChatRoom pending = room(1L, ChatRoomStatus.PENDING, recipient("A", BigDecimal.valueOf(90)), pinId(1), "P", null);
        ChatRoom active = room(2L, ChatRoomStatus.ACTIVE, recipient("B", BigDecimal.valueOf(90)), pinId(2), "P", null);
        ChatRoom refused = room(3L, ChatRoomStatus.REFUSED, recipient("C", BigDecimal.valueOf(90)), pinId(3), "P", null);
        ChatRoom left = room(4L, ChatRoomStatus.LEFT, recipient("D", BigDecimal.valueOf(90)), pinId(4), "P", null);
        given(chatRoomRepository.findSentRoomsFirstPage(eq(MEMBER_ID), any()))
                .willReturn(List.of(pending, active, refused, left));

        List<ChatRoomListItem> items = service.getMySentChatRooms(MEMBER_ID, null, null).items();

        assertThat(items).extracting(ChatRoomListItem::status).containsExactly(
                ChatRoomSummaryStatus.PENDING,
                ChatRoomSummaryStatus.ACTIVE,
                ChatRoomSummaryStatus.CLOSED,
                ChatRoomSummaryStatus.CLOSED);
    }

    @Test
    @DisplayName("상대가 보낸 안읽은 메시지가 있으면 hasUnread=true, 다 읽었거나 상대 메시지가 없으면 false다")
    void 안읽은_상대메시지_유무로_hasUnread를_판정한다() {
        ChatRoom unread = room(1L, ChatRoomStatus.ACTIVE, recipient("A", BigDecimal.valueOf(90)), pinId(1), "P", null);
        ChatRoom read = room(2L, ChatRoomStatus.ACTIVE, recipient("B", BigDecimal.valueOf(90)), pinId(2), "P", null);
        ChatRoom noOther = room(3L, ChatRoomStatus.ACTIVE, recipient("C", BigDecimal.valueOf(90)), pinId(3), "P", null);
        ChatRoom neverRead = room(4L, ChatRoomStatus.PENDING, recipient("D", BigDecimal.valueOf(90)), pinId(4), "P", null);
        given(chatRoomRepository.findSentRoomsFirstPage(eq(MEMBER_ID), any()))
                .willReturn(List.of(unread, read, noOther, neverRead));

        // 상대 발신 최대 메시지 id: room1=5, room2=5, room4=2 (room3은 상대 메시지 없음)
        RoomOtherMessageId o1 = otherMax(1L, 5L);
        RoomOtherMessageId o2 = otherMax(2L, 5L);
        RoomOtherMessageId o4 = otherMax(4L, 2L);
        given(chatMessageRepository.findMaxOtherSenderMessageIds(any(), eq(MEMBER_ID)))
                .willReturn(List.of(o1, o2, o4));
        // 내 읽음 포인터: room1=3(미읽음 존재), room2=5(다 읽음). room4는 포인터 없음(=읽은 적 없음)
        RoomReadPointer p1 = readPointer(1L, 3L);
        RoomReadPointer p2 = readPointer(2L, 5L);
        given(chatRoomMemberRepository.findReadPointers(any(), eq(MEMBER_ID)))
                .willReturn(List.of(p1, p2));

        List<ChatRoomListItem> items = service.getMySentChatRooms(MEMBER_ID, null, null).items();

        assertThat(items).extracting(ChatRoomListItem::hasUnread)
                .containsExactly(true, false, false, true);
    }

    @Test
    @DisplayName("lastMessage는 마스킹된 표시용 문자열을 우선 사용하고 없으면 원문을 사용한다")
    void lastMessage는_마스킹값을_우선_사용하고_없으면_원문을_사용한다() {
        ChatRoom masked = room(1L, ChatRoomStatus.ACTIVE, recipient("A", BigDecimal.valueOf(90)), pinId(1), "P", null);
        ChatRoom plain = room(2L, ChatRoomStatus.ACTIVE, recipient("B", BigDecimal.valueOf(90)), pinId(2), "P", null);
        given(chatRoomRepository.findSentRoomsFirstPage(eq(MEMBER_ID), any())).willReturn(List.of(masked, plain));
        Instant t = Instant.parse("2026-08-04T05:00:00Z");
        ChatMessage maskedMsg = lastMessage(1L, "욕설 원문", "욕설 **", t);
        ChatMessage plainMsg = lastMessage(2L, "정상 메시지", null, t);
        given(chatMessageRepository.findLastMessagesByRoomIds(any())).willReturn(List.of(maskedMsg, plainMsg));

        List<ChatRoomListItem> items = service.getMySentChatRooms(MEMBER_ID, null, null).items();

        assertThat(items.get(0).lastMessage()).isEqualTo("욕설 **");
        assertThat(items.get(1).lastMessage()).isEqualTo("정상 메시지");
    }

    @Test
    @DisplayName("조회 결과가 limit을 초과하면 초과분을 잘라내고 마지막 노출 방의 (활동시각, roomId)로 nextCursor를 발급한다")
    void limit초과시_nextCursor를_마지막메시지시각으로_발급한다() {
        ChatRoom r1 = room(1L, ChatRoomStatus.ACTIVE, recipient("A", BigDecimal.valueOf(90)), pinId(1), "P", null);
        ChatRoom r2 = room(2L, ChatRoomStatus.ACTIVE, recipient("B", BigDecimal.valueOf(90)), pinId(2), "P", null);
        ChatRoom r3 = room(3L, ChatRoomStatus.ACTIVE, recipient("C", BigDecimal.valueOf(90)), pinId(3), "P", null);
        // limit=2 → limit+1(3)건 반환. 3번째는 다음 페이지 존재 신호.
        given(chatRoomRepository.findSentRoomsFirstPage(eq(MEMBER_ID), any())).willReturn(List.of(r1, r2, r3));
        Instant activity2 = Instant.parse("2026-08-04T04:05:00Z");
        ChatMessage msg2 = lastMessage(2L, "네 아직 많아요", null, activity2);
        given(chatMessageRepository.findLastMessagesByRoomIds(any())).willReturn(List.of(msg2));

        ChatRoomListResponse response = service.getMySentChatRooms(MEMBER_ID, null, "2");

        assertThat(response.items()).extracting(ChatRoomListItem::roomId).containsExactly(1L, 2L);
        assertThat(response.nextCursor()).isNotNull();
        ChatRoomCursor decoded = ChatRoomCursor.decode(response.nextCursor());
        assertThat(decoded.lastActivityAt()).isEqualTo(activity2);
        assertThat(decoded.roomId()).isEqualTo(2L);
    }

    @Test
    @DisplayName("마지막 노출 방에 메시지가 없으면 방 생성 시각으로 nextCursor를 발급한다")
    void 마지막방에_메시지가_없으면_방생성시각으로_nextCursor를_발급한다() {
        Instant created1 = Instant.parse("2026-08-04T02:00:00Z");
        ChatRoom r1 = room(1L, ChatRoomStatus.PENDING, recipient("A", BigDecimal.valueOf(90)), pinId(1), "P", created1);
        ChatRoom r2 = room(2L, ChatRoomStatus.PENDING, recipient("B", BigDecimal.valueOf(90)), pinId(2), "P", null);
        // limit=1 → 2건 반환, 노출은 r1 하나. r1은 메시지가 없어 활동시각=방 생성시각.
        given(chatRoomRepository.findSentRoomsFirstPage(eq(MEMBER_ID), any())).willReturn(List.of(r1, r2));

        ChatRoomListResponse response = service.getMySentChatRooms(MEMBER_ID, null, "1");

        assertThat(response.items()).extracting(ChatRoomListItem::roomId).containsExactly(1L);
        ChatRoomCursor decoded = ChatRoomCursor.decode(response.nextCursor());
        assertThat(decoded.lastActivityAt()).isEqualTo(created1);
        assertThat(decoded.roomId()).isEqualTo(1L);
    }

    @Test
    @DisplayName("커서를 전달하면 디코딩한 (활동시각, roomId)로 커서 이후 페이지를 조회한다")
    void 커서를_전달하면_커서이후_페이지를_조회한다() {
        Instant cursorActivity = Instant.parse("2026-08-04T04:05:00Z");
        String cursor = new ChatRoomCursor(cursorActivity, 2L).encode();
        ChatRoom r = room(3L, ChatRoomStatus.ACTIVE, recipient("C", BigDecimal.valueOf(90)), pinId(3), "P", null);
        given(chatRoomRepository.findSentRoomsAfterCursor(eq(MEMBER_ID), eq(cursorActivity), eq(2L), any()))
                .willReturn(List.of(r));

        ChatRoomListResponse response = service.getMySentChatRooms(MEMBER_ID, cursor, "20");

        assertThat(response.items()).extracting(ChatRoomListItem::roomId).containsExactly(3L);
        assertThat(response.nextCursor()).isNull();
        verify(chatRoomRepository).findSentRoomsAfterCursor(MEMBER_ID, cursorActivity, 2L, PageRequest.of(0, 21));
        verify(chatRoomRepository, never()).findSentRoomsFirstPage(any(), any());
    }

    @Test
    @DisplayName("결과가 없으면 빈 배열과 null nextCursor를 반환하고 부가 정보를 조회하지 않는다")
    void 결과가_없으면_빈배열을_반환한다() {
        given(chatRoomRepository.findSentRoomsFirstPage(eq(MEMBER_ID), any())).willReturn(List.of());

        ChatRoomListResponse response = service.getMySentChatRooms(MEMBER_ID, null, null);

        assertThat(response.items()).isEmpty();
        assertThat(response.nextCursor()).isNull();
        verifyNoInteractions(chatMessageRepository, chatRoomMemberRepository);
    }

    @Test
    @DisplayName("limit이 범위를 벗어나거나 숫자가 아니면 조회하지 않고 INVALID_PAGINATION으로 실패한다")
    void limit이_잘못되면_INVALID_PAGINATION() {
        assertInvalidPagination(() -> service.getMySentChatRooms(MEMBER_ID, null, "0"));
        assertInvalidPagination(() -> service.getMySentChatRooms(MEMBER_ID, null, "51"));
        assertInvalidPagination(() -> service.getMySentChatRooms(MEMBER_ID, null, "abc"));

        verify(chatRoomRepository, never()).findSentRoomsFirstPage(any(), any());
        verifyNoInteractions(chatMessageRepository, chatRoomMemberRepository);
    }

    @Test
    @DisplayName("커서 형식이 잘못되면 조회하지 않고 INVALID_PAGINATION으로 실패한다")
    void 커서형식이_잘못되면_INVALID_PAGINATION() {
        assertInvalidPagination(() -> service.getMySentChatRooms(MEMBER_ID, "not-a-valid-cursor!!!", null));

        verify(chatRoomRepository, never()).findSentRoomsAfterCursor(any(), any(), any(), any());
        verifyNoInteractions(chatMessageRepository, chatRoomMemberRepository);
    }

    @Test
    @DisplayName("조회 중 예기치 못한 오류는 CHAT_ROOMS_FETCH_FAILED로 처리한다")
    void 조회중_오류는_CHAT_ROOMS_FETCH_FAILED() {
        given(chatRoomRepository.findSentRoomsFirstPage(eq(MEMBER_ID), any()))
                .willThrow(new RuntimeException("db down"));

        assertThatThrownBy(() -> service.getMySentChatRooms(MEMBER_ID, null, null))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CHAT_ROOMS_FETCH_FAILED);
    }

    // ===== helpers =====

    private void assertInvalidPagination(org.assertj.core.api.ThrowableAssert.ThrowingCallable callable) {
        assertThatThrownBy(callable)
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.INVALID_PAGINATION);
    }

    private Member recipient(String nickname, BigDecimal viewAngle) {
        Member m = mock(Member.class);
        lenient().when(m.getNickname()).thenReturn(nickname);
        lenient().when(m.getViewAngle()).thenReturn(viewAngle);
        return m;
    }

    private ChatRoom room(Long id, ChatRoomStatus status, Member recipient,
                          UUID pinId, String placeName, Instant createdAt) {
        Place place = mock(Place.class);
        lenient().when(place.getName()).thenReturn(placeName);
        Pin pin = mock(Pin.class);
        lenient().when(pin.getId()).thenReturn(pinId);
        lenient().when(pin.getPlace()).thenReturn(place);
        ChatRoom room = mock(ChatRoom.class);
        lenient().when(room.getId()).thenReturn(id);
        lenient().when(room.getStatus()).thenReturn(status);
        lenient().when(room.getRecipient()).thenReturn(recipient);
        lenient().when(room.getPin()).thenReturn(pin);
        lenient().when(room.getCreatedAt()).thenReturn(createdAt);
        return room;
    }

    private ChatMessage lastMessage(Long roomId, String content, String maskedContent, Instant createdAt) {
        ChatRoom r = mock(ChatRoom.class);
        lenient().when(r.getId()).thenReturn(roomId);
        ChatMessage m = mock(ChatMessage.class);
        lenient().when(m.getChatRoom()).thenReturn(r);
        lenient().when(m.getContent()).thenReturn(content);
        lenient().when(m.getMaskedContent()).thenReturn(maskedContent);
        lenient().when(m.getCreatedAt()).thenReturn(createdAt);
        return m;
    }

    private RoomOtherMessageId otherMax(Long roomId, Long maxOtherMessageId) {
        RoomOtherMessageId p = mock(RoomOtherMessageId.class);
        lenient().when(p.getRoomId()).thenReturn(roomId);
        lenient().when(p.getMaxOtherMessageId()).thenReturn(maxOtherMessageId);
        return p;
    }

    private RoomReadPointer readPointer(Long roomId, Long lastReadMessageId) {
        RoomReadPointer p = mock(RoomReadPointer.class);
        lenient().when(p.getRoomId()).thenReturn(roomId);
        lenient().when(p.getLastReadMessageId()).thenReturn(lastReadMessageId);
        return p;
    }

    private UUID pinId(int seed) {
        return UUID.fromString(String.format("%08d-0000-0000-0000-000000000000", seed));
    }
}
