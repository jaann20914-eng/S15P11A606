package com.yuhan.wagglewaggle.domain.pin.service;

import com.yuhan.wagglewaggle.domain.pin.dto.TodayPinItem;
import com.yuhan.wagglewaggle.domain.pin.dto.TodayPinListResponse;
import com.yuhan.wagglewaggle.domain.pin.dto.TodayPinStatus;
import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import com.yuhan.wagglewaggle.domain.pin.entity.VideoStatus;
import com.yuhan.wagglewaggle.domain.pin.repository.PinRepository;
import com.yuhan.wagglewaggle.domain.place.entity.Place;
import com.yuhan.wagglewaggle.domain.user.entity.AgeGroup;
import com.yuhan.wagglewaggle.domain.user.entity.Gender;
import com.yuhan.wagglewaggle.domain.user.entity.Member;
import com.yuhan.wagglewaggle.domain.user.repository.MemberRepository;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
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

class TodayPinServiceTest {

    private static final Long MEMBER_ID = 42L;
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    // 고정 현재 시각: KST 2026-08-03 10:00 → 서비스 날짜 2026-08-03
    private static final Instant NOW = LocalDateTime.of(2026, 8, 3, 10, 0).atZone(KST).toInstant();
    // 오늘 윈도우 [start, end) = 2026-08-03 04:00 KST ~ 2026-08-04 04:00 KST
    private static final Instant EXPECTED_START = LocalDate.of(2026, 8, 3).atTime(4, 0).atZone(KST).toInstant();
    private static final Instant EXPECTED_END = LocalDate.of(2026, 8, 4).atTime(4, 0).atZone(KST).toInstant();

    private MemberRepository memberRepository;
    private PinRepository pinRepository;
    private TodayPinService service;

    @BeforeEach
    void setUp() {
        memberRepository = mock(MemberRepository.class);
        pinRepository = mock(PinRepository.class);
        Clock clock = Clock.fixed(NOW, KST);
        service = new TodayPinService(memberRepository, pinRepository, clock);

        // 기본: 유효한 사용자
        given(memberRepository.findById(MEMBER_ID)).willReturn(Optional.of(activeMember()));
    }

    @Test
    @DisplayName("커서 없이 조회하면 기본 limit(20)으로 첫 페이지를 조회하고 오늘 윈도우를 계산해 넘긴다")
    void firstPage_defaultLimit_computesTodayWindow() {
        // 중첩 스터빙 방지를 위해 mock 핀 리스트를 먼저 구성한 뒤 스터빙한다.
        List<Pin> pins = List.of(
                pin(UUID.randomUUID(), 1L, "카페 A", "서울 광진구", VideoStatus.PENDING, NOW),
                pin(UUID.randomUUID(), 2L, "카페 B", "서울 성동구", VideoStatus.ACTIVE, NOW));
        given(pinRepository.findTodayPinsFirstPage(eq(MEMBER_ID), any(), any(), any()))
                .willReturn(pins);

        TodayPinListResponse response = service.getMyTodayPins(MEMBER_ID, null, null);

        assertThat(response.items()).hasSize(2);
        assertThat(response.nextCursor()).isNull();

        ArgumentCaptor<Instant> startCaptor = ArgumentCaptor.forClass(Instant.class);
        ArgumentCaptor<Instant> endCaptor = ArgumentCaptor.forClass(Instant.class);
        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
        verify(pinRepository).findTodayPinsFirstPage(
                eq(MEMBER_ID), startCaptor.capture(), endCaptor.capture(), pageableCaptor.capture());
        assertThat(startCaptor.getValue()).isEqualTo(EXPECTED_START);
        assertThat(endCaptor.getValue()).isEqualTo(EXPECTED_END);
        // limit + 1건을 조회한다
        assertThat(pageableCaptor.getValue()).isEqualTo(PageRequest.of(0, 21));
        verify(pinRepository, never()).findTodayPinsAfterCursor(any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("내부 상태를 외부 표현(PROCESSING·ACTIVE·RESHOOT·FAILED)으로 매핑한다")
    void statusMapping() {
        List<Pin> pins = List.of(
                pin(UUID.randomUUID(), 1L, "A", "a", VideoStatus.PENDING, NOW),
                pin(UUID.randomUUID(), 2L, "B", "b", VideoStatus.ACTIVE, NOW),
                pin(UUID.randomUUID(), 3L, "C", "c", VideoStatus.REJECTED, NOW),
                pin(UUID.randomUUID(), 4L, "D", "d", VideoStatus.FAILED, NOW));
        given(pinRepository.findTodayPinsFirstPage(eq(MEMBER_ID), any(), any(), any()))
                .willReturn(pins);

        List<TodayPinItem> items = service.getMyTodayPins(MEMBER_ID, null, null).items();

        assertThat(items).extracting(TodayPinItem::status).containsExactly(
                TodayPinStatus.PROCESSING, TodayPinStatus.ACTIVE, TodayPinStatus.RESHOOT, TodayPinStatus.FAILED);
    }

    @Test
    @DisplayName("조회 결과가 limit을 초과하면 초과분을 잘라내고 마지막 항목 기준 nextCursor를 발급한다")
    void hasNextPage_issuesNextCursor() {
        UUID lastId = UUID.fromString("15ab5bf8-3395-4ab8-9904-c49e20a01234");
        Instant lastCreatedAt = Instant.parse("2026-08-03T01:00:00Z");
        // limit=2 → limit+1(3)건 반환. 마지막 3번째는 다음 페이지 존재 신호.
        List<Pin> pins = List.of(
                pin(UUID.randomUUID(), 1L, "A", "a", VideoStatus.ACTIVE, NOW),
                pin(lastId, 2L, "B", "b", VideoStatus.ACTIVE, lastCreatedAt),
                pin(UUID.randomUUID(), 3L, "C", "c", VideoStatus.ACTIVE, NOW));
        given(pinRepository.findTodayPinsFirstPage(eq(MEMBER_ID), any(), any(), any()))
                .willReturn(pins);

        TodayPinListResponse response = service.getMyTodayPins(MEMBER_ID, null, "2");

        assertThat(response.items()).hasSize(2);
        assertThat(response.nextCursor()).isNotNull();
        // nextCursor는 노출된 마지막 항목(2번째)의 (createdAt, id)를 담는다
        TodayPinCursor decoded = TodayPinCursor.decode(response.nextCursor());
        assertThat(decoded.createdAt()).isEqualTo(lastCreatedAt);
        assertThat(decoded.id()).isEqualTo(lastId);
    }

    @Test
    @DisplayName("커서를 전달하면 디코딩한 (createdAt, id)로 커서 이후 페이지를 조회한다")
    void withCursor_queriesAfterCursor() {
        UUID cursorId = UUID.fromString("15ab5bf8-3395-4ab8-9904-c49e20a01234");
        Instant cursorCreatedAt = Instant.parse("2026-08-03T01:00:00Z");
        String cursor = new TodayPinCursor(cursorCreatedAt, cursorId).encode();

        List<Pin> pins = List.of(pin(UUID.randomUUID(), 1L, "A", "a", VideoStatus.ACTIVE, NOW));
        given(pinRepository.findTodayPinsAfterCursor(eq(MEMBER_ID), any(), any(), any(), any(), any()))
                .willReturn(pins);

        TodayPinListResponse response = service.getMyTodayPins(MEMBER_ID, cursor, "20");

        assertThat(response.items()).hasSize(1);
        assertThat(response.nextCursor()).isNull();
        verify(pinRepository).findTodayPinsAfterCursor(
                eq(MEMBER_ID), eq(EXPECTED_START), eq(EXPECTED_END), eq(cursorCreatedAt), eq(cursorId), any());
        verify(pinRepository, never()).findTodayPinsFirstPage(any(), any(), any(), any());
    }

    @Test
    @DisplayName("limit이 범위를 벗어나거나 숫자가 아니면 조회하지 않고 INVALID_PAGINATION으로 실패한다")
    void invalidLimit_throwsInvalidPagination() {
        assertInvalidPagination(() -> service.getMyTodayPins(MEMBER_ID, null, "0"));
        assertInvalidPagination(() -> service.getMyTodayPins(MEMBER_ID, null, "51"));
        assertInvalidPagination(() -> service.getMyTodayPins(MEMBER_ID, null, "abc"));

        verify(pinRepository, never()).findTodayPinsFirstPage(any(), any(), any(), any());
        verify(memberRepository, never()).findById(any());
    }

    @Test
    @DisplayName("커서 형식이 잘못되면 조회하지 않고 INVALID_PAGINATION으로 실패한다")
    void invalidCursor_throwsInvalidPagination() {
        assertInvalidPagination(() -> service.getMyTodayPins(MEMBER_ID, "not-base64!!!", null));

        verify(pinRepository, never()).findTodayPinsAfterCursor(any(), any(), any(), any(), any(), any());
        verify(memberRepository, never()).findById(any());
    }

    @Test
    @DisplayName("토큰의 사용자가 존재하지 않으면 USER_NOT_FOUND로 실패한다")
    void userNotFound() {
        given(memberRepository.findById(MEMBER_ID)).willReturn(Optional.empty());

        assertThatThrownBy(() -> service.getMyTodayPins(MEMBER_ID, null, null))
                .isInstanceOf(CustomException.class)
                .extracting(e -> ((CustomException) e).getErrorCode())
                .isEqualTo(ErrorCode.USER_NOT_FOUND);
    }

    @Test
    @DisplayName("탈퇴한 사용자면 USER_NOT_FOUND로 실패한다")
    void withdrawnUser() {
        Member withdrawn = activeMember();
        ReflectionTestUtils.setField(withdrawn, "deletedAt", Instant.now());
        given(memberRepository.findById(MEMBER_ID)).willReturn(Optional.of(withdrawn));

        assertThatThrownBy(() -> service.getMyTodayPins(MEMBER_ID, null, null))
                .isInstanceOf(CustomException.class)
                .extracting(e -> ((CustomException) e).getErrorCode())
                .isEqualTo(ErrorCode.USER_NOT_FOUND);
    }

    @Test
    @DisplayName("조회 중 예기치 못한 오류는 TODAY_PINS_FETCH_FAILED로 처리한다")
    void fetchFailed() {
        given(pinRepository.findTodayPinsFirstPage(eq(MEMBER_ID), any(), any(), any()))
                .willThrow(new RuntimeException("db down"));

        assertThatThrownBy(() -> service.getMyTodayPins(MEMBER_ID, null, null))
                .isInstanceOf(CustomException.class)
                .extracting(e -> ((CustomException) e).getErrorCode())
                .isEqualTo(ErrorCode.TODAY_PINS_FETCH_FAILED);
    }

    // ===== helpers =====

    private void assertInvalidPagination(org.assertj.core.api.ThrowableAssert.ThrowingCallable callable) {
        assertThatThrownBy(callable)
                .isInstanceOf(CustomException.class)
                .extracting(e -> ((CustomException) e).getErrorCode())
                .isEqualTo(ErrorCode.INVALID_PAGINATION);
    }

    private Member activeMember() {
        return Member.create("와글러", AgeGroup.TWENTIES, Gender.FEMALE);
    }

    private Pin pin(UUID id, Long placeId, String placeName, String placeAddress,
                    VideoStatus status, Instant createdAt) {
        Pin pin = mock(Pin.class);
        Place place = mock(Place.class);
        given(pin.getId()).willReturn(id);
        given(pin.getPlace()).willReturn(place);
        given(pin.getVideoStatus()).willReturn(status);
        given(pin.getCreatedAt()).willReturn(createdAt);
        given(place.getId()).willReturn(placeId);
        given(place.getName()).willReturn(placeName);
        given(place.getAddressName()).willReturn(placeAddress);
        return pin;
    }
}
