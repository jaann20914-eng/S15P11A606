package com.yuhan.wagglewaggle.domain.chat.service;

import com.yuhan.wagglewaggle.domain.chat.dto.ChatPinListItem;
import com.yuhan.wagglewaggle.domain.chat.dto.ChatPinListResponse;
import com.yuhan.wagglewaggle.domain.chat.repository.ChatRoomRepository;
import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import com.yuhan.wagglewaggle.domain.pin.entity.PublisherStatus;
import com.yuhan.wagglewaggle.domain.pin.repository.PinRepository;
import com.yuhan.wagglewaggle.domain.place.entity.Place;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;

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
class ChatPinListServiceTest {

    private static final Long MEMBER_ID = 900201L;

    @Mock private PinRepository pinRepository;
    @Mock private ChatRoomRepository chatRoomRepository;

    private ChatPinListService service;

    @BeforeEach
    void setUp() {
        service = new ChatPinListService(pinRepository, chatRoomRepository);
    }

    @Test
    @DisplayName("커서 없이 조회하면 기본 limit(20)으로 첫 페이지를 조회하고 핀 정보를 매핑한다")
    void 커서없이_조회하면_기본limit으로_첫페이지를_조회하고_핀정보를_매핑한다() {
        UUID idA = pinId(1);
        UUID idB = pinId(2);
        Instant tA = Instant.parse("2026-07-24T14:00:00Z");
        Instant tB = Instant.parse("2026-07-24T13:00:00Z");
        Pin pinA = pin(idA, tA, "바나프레소 역삼점", "서울 광진구 동일로 60길 47");
        Pin pinB = pin(idB, tB, "메가커피 건대점", "서울 광진구 능동로 110");

        given(pinRepository.findReceivedChatPinsFirstPage(eq(MEMBER_ID), any())).willReturn(List.of(pinA, pinB));
        // pinA만 안읽음이 있는 핀으로 집계됨
        given(chatRoomRepository.findPinIdsWithUnreadForRecipient(any(), eq(MEMBER_ID))).willReturn(List.of(idA));

        ChatPinListResponse response = service.getMyReceivedChatPins(MEMBER_ID, null, null);

        assertThat(response.items()).hasSize(2);
        assertThat(response.nextCursor()).isNull();

        ChatPinListItem i0 = response.items().get(0);
        assertThat(i0.pinId()).isEqualTo(idA);
        assertThat(i0.createdAt()).isEqualTo(tA);
        assertThat(i0.placeName()).isEqualTo("바나프레소 역삼점");
        assertThat(i0.placeAddress()).isEqualTo("서울 광진구 동일로 60길 47");
        assertThat(i0.hasUnread()).isTrue();

        ChatPinListItem i1 = response.items().get(1);
        assertThat(i1.pinId()).isEqualTo(idB);
        assertThat(i1.hasUnread()).isFalse();

        // 기본 limit=20 → limit+1(21)건 요청, 커서 이후 페이지는 조회하지 않는다.
        verify(pinRepository).findReceivedChatPinsFirstPage(MEMBER_ID, PageRequest.of(0, 21));
        verify(pinRepository, never()).findReceivedChatPinsAfterCursor(any(), any(), any(), any());
    }

    @Test
    @DisplayName("안읽음 집계 결과에 포함된 핀만 hasUnread=true로 매핑한다")
    void 안읽음_집계결과에_포함된_핀만_hasUnread_true() {
        UUID idA = pinId(1);
        UUID idB = pinId(2);
        UUID idC = pinId(3);
        Pin pinA = pin(idA, Instant.parse("2026-07-24T14:00:00Z"), "P", "A");
        Pin pinB = pin(idB, Instant.parse("2026-07-24T13:00:00Z"), "P", "B");
        Pin pinC = pin(idC, Instant.parse("2026-07-24T12:00:00Z"), "P", "C");
        given(pinRepository.findReceivedChatPinsFirstPage(eq(MEMBER_ID), any()))
                .willReturn(List.of(pinA, pinB, pinC));
        // A, C만 안읽음
        given(chatRoomRepository.findPinIdsWithUnreadForRecipient(any(), eq(MEMBER_ID)))
                .willReturn(List.of(idA, idC));

        List<ChatPinListItem> items = service.getMyReceivedChatPins(MEMBER_ID, null, null).items();

        assertThat(items).extracting(ChatPinListItem::hasUnread).containsExactly(true, false, true);
    }

    @Test
    @DisplayName("각 핀의 제보자 체류 상태(publisherStatus)를 그대로 매핑한다")
    void 제보자_체류상태를_그대로_매핑한다() {
        UUID idA = pinId(1);
        UUID idB = pinId(2);
        Pin stillHere = pin(idA, Instant.parse("2026-07-24T14:00:00Z"), "P", "A", PublisherStatus.STILL_HERE);
        Pin left = pin(idB, Instant.parse("2026-07-24T13:00:00Z"), "P", "B", PublisherStatus.LEFT);
        given(pinRepository.findReceivedChatPinsFirstPage(eq(MEMBER_ID), any()))
                .willReturn(List.of(stillHere, left));
        given(chatRoomRepository.findPinIdsWithUnreadForRecipient(any(), eq(MEMBER_ID))).willReturn(List.of());

        List<ChatPinListItem> items = service.getMyReceivedChatPins(MEMBER_ID, null, null).items();

        assertThat(items).extracting(ChatPinListItem::publisherStatus)
                .containsExactly(PublisherStatus.STILL_HERE, PublisherStatus.LEFT);
    }

    @Test
    @DisplayName("조회 결과가 limit을 초과하면 초과분을 잘라내고 마지막 노출 핀의 (createdAt, id)로 nextCursor를 발급한다")
    void limit초과시_nextCursor를_마지막핀으로_발급한다() {
        UUID idA = pinId(1);
        UUID idB = pinId(2);
        UUID idC = pinId(3);
        Instant tB = Instant.parse("2026-07-24T13:00:00Z");
        Pin pinA = pin(idA, Instant.parse("2026-07-24T14:00:00Z"), "P", "A");
        Pin pinB = pin(idB, tB, "P", "B");
        Pin pinC = pin(idC, Instant.parse("2026-07-24T12:00:00Z"), "P", "C");
        // limit=2 → limit+1(3)건 반환, 3번째는 다음 페이지 신호
        given(pinRepository.findReceivedChatPinsFirstPage(eq(MEMBER_ID), any()))
                .willReturn(List.of(pinA, pinB, pinC));
        given(chatRoomRepository.findPinIdsWithUnreadForRecipient(any(), eq(MEMBER_ID))).willReturn(List.of());

        ChatPinListResponse response = service.getMyReceivedChatPins(MEMBER_ID, null, "2");

        assertThat(response.items()).extracting(ChatPinListItem::pinId).containsExactly(idA, idB);
        assertThat(response.nextCursor()).isNotNull();
        ChatPinCursor decoded = ChatPinCursor.decode(response.nextCursor());
        assertThat(decoded.createdAt()).isEqualTo(tB);
        assertThat(decoded.pinId()).isEqualTo(idB);
    }

    @Test
    @DisplayName("커서를 전달하면 디코딩한 (createdAt, pinId)로 커서 이후 페이지를 조회한다")
    void 커서를_전달하면_커서이후_페이지를_조회한다() {
        Instant cursorCreatedAt = Instant.parse("2026-07-24T13:00:00Z");
        UUID cursorPinId = pinId(2);
        String cursor = new ChatPinCursor(cursorCreatedAt, cursorPinId).encode();
        Pin pinC = pin(pinId(3), Instant.parse("2026-07-24T12:00:00Z"), "P", "C");
        given(pinRepository.findReceivedChatPinsAfterCursor(eq(MEMBER_ID), eq(cursorCreatedAt), eq(cursorPinId), any()))
                .willReturn(List.of(pinC));
        given(chatRoomRepository.findPinIdsWithUnreadForRecipient(any(), eq(MEMBER_ID))).willReturn(List.of());

        ChatPinListResponse response = service.getMyReceivedChatPins(MEMBER_ID, cursor, "20");

        assertThat(response.items()).extracting(ChatPinListItem::pinId).containsExactly(pinId(3));
        assertThat(response.nextCursor()).isNull();
        verify(pinRepository).findReceivedChatPinsAfterCursor(
                MEMBER_ID, cursorCreatedAt, cursorPinId, PageRequest.of(0, 21));
        verify(pinRepository, never()).findReceivedChatPinsFirstPage(any(), any());
    }

    @Test
    @DisplayName("결과가 없으면 빈 배열과 null nextCursor를 반환하고 안읽음 집계를 조회하지 않는다")
    void 결과가_없으면_빈배열을_반환한다() {
        given(pinRepository.findReceivedChatPinsFirstPage(eq(MEMBER_ID), any())).willReturn(List.of());

        ChatPinListResponse response = service.getMyReceivedChatPins(MEMBER_ID, null, null);

        assertThat(response.items()).isEmpty();
        assertThat(response.nextCursor()).isNull();
        verifyNoInteractions(chatRoomRepository);
    }

    @Test
    @DisplayName("limit이 범위를 벗어나거나 숫자가 아니면 조회하지 않고 INVALID_PAGINATION으로 실패한다")
    void limit이_잘못되면_INVALID_PAGINATION() {
        assertInvalidPagination(() -> service.getMyReceivedChatPins(MEMBER_ID, null, "0"));
        assertInvalidPagination(() -> service.getMyReceivedChatPins(MEMBER_ID, null, "51"));
        assertInvalidPagination(() -> service.getMyReceivedChatPins(MEMBER_ID, null, "abc"));

        verify(pinRepository, never()).findReceivedChatPinsFirstPage(any(), any());
        verifyNoInteractions(chatRoomRepository);
    }

    @Test
    @DisplayName("커서 형식이 잘못되면 조회하지 않고 INVALID_PAGINATION으로 실패한다")
    void 커서형식이_잘못되면_INVALID_PAGINATION() {
        assertInvalidPagination(() -> service.getMyReceivedChatPins(MEMBER_ID, "not-a-valid-cursor!!!", null));

        verify(pinRepository, never()).findReceivedChatPinsAfterCursor(any(), any(), any(), any());
        verifyNoInteractions(chatRoomRepository);
    }

    @Test
    @DisplayName("조회 중 예기치 못한 오류는 CHAT_PINS_FETCH_FAILED로 처리한다")
    void 조회중_오류는_CHAT_PINS_FETCH_FAILED() {
        given(pinRepository.findReceivedChatPinsFirstPage(eq(MEMBER_ID), any()))
                .willThrow(new RuntimeException("db down"));

        assertThatThrownBy(() -> service.getMyReceivedChatPins(MEMBER_ID, null, null))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.CHAT_PINS_FETCH_FAILED);
    }

    // ===== helpers =====

    private void assertInvalidPagination(org.assertj.core.api.ThrowableAssert.ThrowingCallable callable) {
        assertThatThrownBy(callable)
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.INVALID_PAGINATION);
    }

    private Pin pin(UUID id, Instant createdAt, String placeName, String placeAddress) {
        return pin(id, createdAt, placeName, placeAddress, PublisherStatus.STILL_HERE);
    }

    private Pin pin(UUID id, Instant createdAt, String placeName, String placeAddress,
                    PublisherStatus publisherStatus) {
        Place place = mock(Place.class);
        lenient().when(place.getName()).thenReturn(placeName);
        lenient().when(place.getAddressName()).thenReturn(placeAddress);
        Pin pin = mock(Pin.class);
        lenient().when(pin.getId()).thenReturn(id);
        lenient().when(pin.getCreatedAt()).thenReturn(createdAt);
        lenient().when(pin.getPlace()).thenReturn(place);
        lenient().when(pin.getPublisherStatus()).thenReturn(publisherStatus);
        return pin;
    }

    private UUID pinId(int seed) {
        return UUID.fromString(String.format("%08d-0000-0000-0000-000000000000", seed));
    }
}
