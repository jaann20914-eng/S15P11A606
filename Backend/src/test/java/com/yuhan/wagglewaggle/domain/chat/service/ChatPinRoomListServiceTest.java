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
class ChatPinRoomListServiceTest {

    private static final Long MEMBER_ID = 900201L;
    private static final UUID PIN_ID = UUID.fromString("aaaa0001-0000-0000-0000-000000000001");

    @Mock private ChatRoomRepository chatRoomRepository;
    @Mock private ChatMessageRepository chatMessageRepository;
    @Mock private ChatRoomMemberRepository chatRoomMemberRepository;

    private ChatPinRoomListService service;

    @BeforeEach
    void setUp() {
        service = new ChatPinRoomListService(chatRoomRepository, chatMessageRepository, chatRoomMemberRepository);
    }

    @Test
    @DisplayName("수신자 시점 조회 시 상대방은 요청자로 매핑하고 방 정보를 채운다")
    void 수신자시점_조회시_상대방은_요청자로_매핑한다() {
        Member me = member(MEMBER_ID, "사장님", BigDecimal.valueOf(90));
        Member guestA = member(900202L, "손님가", BigDecimal.valueOf(92));
        Member guestB = member(900203L, "손님나", new BigDecimal("110.0"));
        // 내가 수신자, 상대는 요청자
        ChatRoom room1 = room(1L, ChatRoomStatus.ACTIVE, guestA, me, "바나프레소 역삼점", null);
        ChatRoom room2 = room(2L, ChatRoomStatus.PENDING, guestB, me, "바나프레소 역삼점", null);

        given(chatRoomRepository.findPinRoomsFirstPage(eq(PIN_ID), eq(MEMBER_ID), any()))
                .willReturn(List.of(room1, room2));
        Instant t1 = Instant.parse("2026-07-24T13:50:00Z");
        ChatMessage msg1 = lastMessage(1L, "안녕하세요 사장님", null, t1);
        given(chatMessageRepository.findLastMessagesByRoomIds(any())).willReturn(List.of(msg1));

        ChatRoomListResponse response = service.getPinChatRooms(MEMBER_ID, PIN_ID, null, null);

        assertThat(response.items()).hasSize(2);
        ChatRoomListItem i0 = response.items().get(0);
        assertThat(i0.roomId()).isEqualTo(1L);
        assertThat(i0.status()).isEqualTo(ChatRoomSummaryStatus.ACTIVE);
        assertThat(i0.pinId()).isEqualTo(PIN_ID);
        assertThat(i0.placeName()).isEqualTo("바나프레소 역삼점");
        // 상대방 = 요청자(손님가)
        assertThat(i0.otherUserNickname()).isEqualTo("손님가");
        assertThat(i0.otherUserViewAngle()).isEqualByComparingTo(BigDecimal.valueOf(92));
        assertThat(i0.lastMessage()).isEqualTo("안녕하세요 사장님");
        assertThat(i0.lastMessageAt()).isEqualTo(t1);

        // 메시지 없는 방은 null
        ChatRoomListItem i1 = response.items().get(1);
        assertThat(i1.otherUserNickname()).isEqualTo("손님나");
        assertThat(i1.lastMessage()).isNull();
        assertThat(i1.lastMessageAt()).isNull();

        verify(chatRoomRepository).findPinRoomsFirstPage(PIN_ID, MEMBER_ID, PageRequest.of(0, 21));
        verify(chatRoomRepository, never()).findPinRoomsAfterCursor(any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("요청자 시점 조회 시 상대방은 수신자로 매핑한다")
    void 요청자시점_조회시_상대방은_수신자로_매핑한다() {
        Member me = member(MEMBER_ID, "요청자나", BigDecimal.valueOf(90));
        Member owner = member(900301L, "가게사장", new BigDecimal("100.0"));
        // 내가 요청자, 상대는 수신자
        ChatRoom room = room(1L, ChatRoomStatus.ACTIVE, me, owner, "카페 A", null);
        given(chatRoomRepository.findPinRoomsFirstPage(eq(PIN_ID), eq(MEMBER_ID), any())).willReturn(List.of(room));

        List<ChatRoomListItem> items = service.getPinChatRooms(MEMBER_ID, PIN_ID, null, null).items();

        assertThat(items.get(0).otherUserNickname()).isEqualTo("가게사장");
        assertThat(items.get(0).otherUserViewAngle()).isEqualByComparingTo(BigDecimal.valueOf(100));
    }

    @Test
    @DisplayName("내부 상태 REFUSED·LEFT는 응답에서 CLOSED로 매핑한다")
    void 내부상태_REFUSED_LEFT는_CLOSED로_매핑한다() {
        Member me = member(MEMBER_ID, "사장님", BigDecimal.valueOf(90));
        ChatRoom pending = room(1L, ChatRoomStatus.PENDING, guest(900202L), me, "P", null);
        ChatRoom active = room(2L, ChatRoomStatus.ACTIVE, guest(900203L), me, "P", null);
        ChatRoom refused = room(3L, ChatRoomStatus.REFUSED, guest(900204L), me, "P", null);
        ChatRoom left = room(4L, ChatRoomStatus.LEFT, guest(900205L), me, "P", null);
        given(chatRoomRepository.findPinRoomsFirstPage(eq(PIN_ID), eq(MEMBER_ID), any()))
                .willReturn(List.of(pending, active, refused, left));

        List<ChatRoomListItem> items = service.getPinChatRooms(MEMBER_ID, PIN_ID, null, null).items();

        assertThat(items).extracting(ChatRoomListItem::status).containsExactly(
                ChatRoomSummaryStatus.PENDING,
                ChatRoomSummaryStatus.ACTIVE,
                ChatRoomSummaryStatus.CLOSED,
                ChatRoomSummaryStatus.CLOSED);
    }

    @Test
    @DisplayName("상대가 보낸 안읽은 메시지가 있으면 hasUnread=true, 다 읽었거나 상대 메시지가 없으면 false다")
    void 안읽은_상대메시지_유무로_hasUnread를_판정한다() {
        Member me = member(MEMBER_ID, "사장님", BigDecimal.valueOf(90));
        ChatRoom unread = room(1L, ChatRoomStatus.ACTIVE, guest(900202L), me, "P", null);
        ChatRoom read = room(2L, ChatRoomStatus.ACTIVE, guest(900203L), me, "P", null);
        ChatRoom noOther = room(3L, ChatRoomStatus.ACTIVE, guest(900204L), me, "P", null);
        ChatRoom neverRead = room(4L, ChatRoomStatus.PENDING, guest(900205L), me, "P", null);
        given(chatRoomRepository.findPinRoomsFirstPage(eq(PIN_ID), eq(MEMBER_ID), any()))
                .willReturn(List.of(unread, read, noOther, neverRead));

        RoomOtherMessageId o1 = otherMax(1L, 5L);
        RoomOtherMessageId o2 = otherMax(2L, 5L);
        RoomOtherMessageId o4 = otherMax(4L, 2L);
        given(chatMessageRepository.findMaxOtherSenderMessageIds(any(), eq(MEMBER_ID)))
                .willReturn(List.of(o1, o2, o4));
        RoomReadPointer p1 = readPointer(1L, 3L);
        RoomReadPointer p2 = readPointer(2L, 5L);
        given(chatRoomMemberRepository.findReadPointers(any(), eq(MEMBER_ID)))
                .willReturn(List.of(p1, p2));

        List<ChatRoomListItem> items = service.getPinChatRooms(MEMBER_ID, PIN_ID, null, null).items();

        assertThat(items).extracting(ChatRoomListItem::hasUnread)
                .containsExactly(true, false, false, true);
    }

    @Test
    @DisplayName("조회 결과가 limit을 초과하면 초과분을 잘라내고 마지막 노출 방의 (활동시각, roomId)로 nextCursor를 발급한다")
    void limit초과시_nextCursor를_발급한다() {
        Member me = member(MEMBER_ID, "사장님", BigDecimal.valueOf(90));
        ChatRoom r1 = room(1L, ChatRoomStatus.ACTIVE, guest(900202L), me, "P", null);
        ChatRoom r2 = room(2L, ChatRoomStatus.ACTIVE, guest(900203L), me, "P", null);
        ChatRoom r3 = room(3L, ChatRoomStatus.ACTIVE, guest(900204L), me, "P", null);
        given(chatRoomRepository.findPinRoomsFirstPage(eq(PIN_ID), eq(MEMBER_ID), any()))
                .willReturn(List.of(r1, r2, r3));
        Instant activity2 = Instant.parse("2026-07-24T13:00:00Z");
        ChatMessage msg2 = lastMessage(2L, "네 자리 있어요", null, activity2);
        given(chatMessageRepository.findLastMessagesByRoomIds(any())).willReturn(List.of(msg2));

        ChatRoomListResponse response = service.getPinChatRooms(MEMBER_ID, PIN_ID, null, "2");

        assertThat(response.items()).extracting(ChatRoomListItem::roomId).containsExactly(1L, 2L);
        ChatRoomCursor decoded = ChatRoomCursor.decode(response.nextCursor());
        assertThat(decoded.lastActivityAt()).isEqualTo(activity2);
        assertThat(decoded.roomId()).isEqualTo(2L);
    }

    @Test
    @DisplayName("커서를 전달하면 디코딩한 (활동시각, roomId)로 커서 이후 페이지를 조회한다")
    void 커서를_전달하면_커서이후_페이지를_조회한다() {
        Member me = member(MEMBER_ID, "사장님", BigDecimal.valueOf(90));
        Instant cursorActivity = Instant.parse("2026-07-24T13:00:00Z");
        String cursor = new ChatRoomCursor(cursorActivity, 2L).encode();
        ChatRoom r = room(3L, ChatRoomStatus.ACTIVE, guest(900204L), me, "P", null);
        given(chatRoomRepository.findPinRoomsAfterCursor(eq(PIN_ID), eq(MEMBER_ID), eq(cursorActivity), eq(2L), any()))
                .willReturn(List.of(r));

        ChatRoomListResponse response = service.getPinChatRooms(MEMBER_ID, PIN_ID, cursor, "20");

        assertThat(response.items()).extracting(ChatRoomListItem::roomId).containsExactly(3L);
        assertThat(response.nextCursor()).isNull();
        verify(chatRoomRepository).findPinRoomsAfterCursor(PIN_ID, MEMBER_ID, cursorActivity, 2L, PageRequest.of(0, 21));
        verify(chatRoomRepository, never()).findPinRoomsFirstPage(any(), any(), any());
    }

    @Test
    @DisplayName("미참여이거나 없는 핀이면 빈 배열과 null nextCursor를 반환하고 부가 정보를 조회하지 않는다")
    void 결과가_없으면_빈배열을_반환한다() {
        given(chatRoomRepository.findPinRoomsFirstPage(eq(PIN_ID), eq(MEMBER_ID), any())).willReturn(List.of());

        ChatRoomListResponse response = service.getPinChatRooms(MEMBER_ID, PIN_ID, null, null);

        assertThat(response.items()).isEmpty();
        assertThat(response.nextCursor()).isNull();
        verifyNoInteractions(chatMessageRepository, chatRoomMemberRepository);
    }

    @Test
    @DisplayName("limit이 범위를 벗어나거나 숫자가 아니면 조회하지 않고 INVALID_PAGINATION으로 실패한다")
    void limit이_잘못되면_INVALID_PAGINATION() {
        assertInvalidPagination(() -> service.getPinChatRooms(MEMBER_ID, PIN_ID, null, "0"));
        assertInvalidPagination(() -> service.getPinChatRooms(MEMBER_ID, PIN_ID, null, "51"));
        assertInvalidPagination(() -> service.getPinChatRooms(MEMBER_ID, PIN_ID, null, "abc"));

        verify(chatRoomRepository, never()).findPinRoomsFirstPage(any(), any(), any());
        verifyNoInteractions(chatMessageRepository, chatRoomMemberRepository);
    }

    @Test
    @DisplayName("커서 형식이 잘못되면 조회하지 않고 INVALID_PAGINATION으로 실패한다")
    void 커서형식이_잘못되면_INVALID_PAGINATION() {
        assertInvalidPagination(() -> service.getPinChatRooms(MEMBER_ID, PIN_ID, "not-a-valid-cursor!!!", null));

        verify(chatRoomRepository, never()).findPinRoomsAfterCursor(any(), any(), any(), any(), any());
        verifyNoInteractions(chatMessageRepository, chatRoomMemberRepository);
    }

    @Test
    @DisplayName("조회 중 예기치 못한 오류는 CHAT_ROOMS_FETCH_FAILED로 처리한다")
    void 조회중_오류는_CHAT_ROOMS_FETCH_FAILED() {
        given(chatRoomRepository.findPinRoomsFirstPage(eq(PIN_ID), eq(MEMBER_ID), any()))
                .willThrow(new RuntimeException("db down"));

        assertThatThrownBy(() -> service.getPinChatRooms(MEMBER_ID, PIN_ID, null, null))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CHAT_ROOMS_FETCH_FAILED);
    }

    // ===== helpers =====

    private void assertInvalidPagination(org.assertj.core.api.ThrowableAssert.ThrowingCallable callable) {
        assertThatThrownBy(callable)
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.INVALID_PAGINATION);
    }

    private Member member(Long id, String nickname, BigDecimal viewAngle) {
        Member m = mock(Member.class);
        lenient().when(m.getId()).thenReturn(id);
        lenient().when(m.getNickname()).thenReturn(nickname);
        lenient().when(m.getViewAngle()).thenReturn(viewAngle);
        return m;
    }

    /** 상대방 표시값 검증이 필요 없는 방을 만들 때 쓰는 간단한 요청자. */
    private Member guest(Long id) {
        return member(id, "손님" + id, BigDecimal.valueOf(90));
    }

    private ChatRoom room(Long id, ChatRoomStatus status, Member requester, Member recipient,
                          String placeName, Instant createdAt) {
        Place place = mock(Place.class);
        lenient().when(place.getName()).thenReturn(placeName);
        Pin pin = mock(Pin.class);
        lenient().when(pin.getId()).thenReturn(PIN_ID);
        lenient().when(pin.getPlace()).thenReturn(place);
        ChatRoom room = mock(ChatRoom.class);
        lenient().when(room.getId()).thenReturn(id);
        lenient().when(room.getStatus()).thenReturn(status);
        lenient().when(room.getRequester()).thenReturn(requester);
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
}
