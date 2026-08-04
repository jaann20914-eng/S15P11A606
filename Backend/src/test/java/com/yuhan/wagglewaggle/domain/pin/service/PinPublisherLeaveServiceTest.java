package com.yuhan.wagglewaggle.domain.pin.service;

import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoom;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoomStatus;
import com.yuhan.wagglewaggle.domain.chat.repository.ChatRoomRepository;
import com.yuhan.wagglewaggle.domain.pin.dto.PinLeaveResponse;
import com.yuhan.wagglewaggle.domain.pin.entity.CrowdLevel;
import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import com.yuhan.wagglewaggle.domain.pin.entity.PublisherStatus;
import com.yuhan.wagglewaggle.domain.pin.repository.PinRepository;
import com.yuhan.wagglewaggle.domain.place.entity.Place;
import com.yuhan.wagglewaggle.domain.user.entity.AgeGroup;
import com.yuhan.wagglewaggle.domain.user.entity.Gender;
import com.yuhan.wagglewaggle.domain.user.entity.Member;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PinPublisherLeaveServiceTest {

    @Mock private PinRepository pinRepository;
    @Mock private ChatRoomRepository chatRoomRepository;

    private PinPublisherLeaveService service;

    private static final Long MEMBER_ID = 42L;
    private static final Long OTHER_MEMBER_ID = 99L;
    private static final String RAW_PIN_ID = "11111111-2222-3333-4444-555555555555";
    private static final UUID PIN_ID = UUID.fromString(RAW_PIN_ID);
    private static final Instant SERVER_NOW = Instant.parse("2026-08-04T00:00:00Z");

    private static final GeometryFactory GF = new GeometryFactory(new PrecisionModel(), 4326);

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(SERVER_NOW, ZoneOffset.UTC);
        service = new PinPublisherLeaveService(pinRepository, chatRoomRepository, clock);
        given(chatRoomRepository.findByPin_IdAndStatusIn(any(), any())).willReturn(List.of());
    }

    private Pin pinOwnedBy(Long ownerId) {
        Member member = Member.create("tester", AgeGroup.TWENTIES, Gender.MALE);
        ReflectionTestUtils.setField(member, "id", ownerId);
        Place place = Place.create("kakao-1", "장소", point());
        ReflectionTestUtils.setField(place, "id", 1L);
        Pin pin = Pin.create(member, place, CrowdLevel.WAGLE, point(),
                "2층 창가", "메모", "pins/original/42/original.mp4", SERVER_NOW.plusSeconds(3600));
        ReflectionTestUtils.setField(pin, "id", PIN_ID);
        return pin;
    }

    private ChatRoom roomWithStatus(Long id, ChatRoomStatus status) {
        ChatRoom room = ChatRoom.create(
                Mockito.mock(Pin.class),
                Mockito.mock(Member.class),
                Mockito.mock(Member.class));
        ReflectionTestUtils.setField(room, "id", id);
        ReflectionTestUtils.setField(room, "status", status);
        return room;
    }

    private static Point point() {
        return GF.createPoint(new Coordinate(127.0, 37.5));
    }

    @Test
    void 정상_떠남처리하면_핀을_LEFT로_전환하고_PENDING_ACTIVE_REFUSED_채팅방을_LEFT로_종료한다() {
        Pin pin = pinOwnedBy(MEMBER_ID);
        given(pinRepository.findByIdForUpdate(PIN_ID)).willReturn(Optional.of(pin));
        ChatRoom pending = roomWithStatus(1L, ChatRoomStatus.PENDING);
        ChatRoom active = roomWithStatus(2L, ChatRoomStatus.ACTIVE);
        ChatRoom refused = roomWithStatus(3L, ChatRoomStatus.REFUSED);
        given(chatRoomRepository.findByPin_IdAndStatusIn(eq(PIN_ID), any()))
                .willReturn(List.of(pending, active, refused));

        PinLeaveResponse response = service.leave(MEMBER_ID, RAW_PIN_ID);

        // 핀 제보자 상태가 LEFT로 전환된다
        assertThat(pin.getPublisherStatus()).isEqualTo(PublisherStatus.LEFT);
        // 조회된 방은 상태와 무관하게 모두 LEFT로 종료되고 ID가 순서대로 수집된다
        assertThat(pending.getStatus()).isEqualTo(ChatRoomStatus.LEFT);
        assertThat(active.getStatus()).isEqualTo(ChatRoomStatus.LEFT);
        assertThat(refused.getStatus()).isEqualTo(ChatRoomStatus.LEFT);
        // 응답
        assertThat(response.pinId()).isEqualTo(PIN_ID);
        assertThat(response.status()).isEqualTo("LEFT");
        assertThat(response.leftChatRoomIds()).containsExactly(1L, 2L, 3L);
        assertThat(response.leftAt()).isEqualTo(SERVER_NOW);
    }

    @Test
    void 종료대상_상태에_PENDING_ACTIVE_REFUSED를_포함하고_이미_LEFT인_방은_제외한다() {
        Pin pin = pinOwnedBy(MEMBER_ID);
        given(pinRepository.findByIdForUpdate(PIN_ID)).willReturn(Optional.of(pin));

        service.leave(MEMBER_ID, RAW_PIN_ID);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Collection<ChatRoomStatus>> captor = ArgumentCaptor.forClass(Collection.class);
        verify(chatRoomRepository).findByPin_IdAndStatusIn(eq(PIN_ID), captor.capture());
        assertThat(captor.getValue())
                .containsExactlyInAnyOrder(
                        ChatRoomStatus.PENDING, ChatRoomStatus.ACTIVE, ChatRoomStatus.REFUSED)
                .doesNotContain(ChatRoomStatus.LEFT);
    }

    @Test
    void 종료할_채팅방이_없으면_leftChatRoomIds는_빈_배열이고_성공한다() {
        Pin pin = pinOwnedBy(MEMBER_ID);
        given(pinRepository.findByIdForUpdate(PIN_ID)).willReturn(Optional.of(pin));

        PinLeaveResponse response = service.leave(MEMBER_ID, RAW_PIN_ID);

        assertThat(pin.getPublisherStatus()).isEqualTo(PublisherStatus.LEFT);
        assertThat(response.leftChatRoomIds()).isEmpty();
        assertThat(response.status()).isEqualTo("LEFT");
    }

    @Test
    void 이미_소프트삭제된_핀도_차단하지_않고_빈_목록으로_성공한다() {
        Pin pin = pinOwnedBy(MEMBER_ID);
        ReflectionTestUtils.setField(pin, "deletedAt", Instant.parse("2026-07-22T04:00:00Z"));
        given(pinRepository.findByIdForUpdate(PIN_ID)).willReturn(Optional.of(pin));

        PinLeaveResponse response = service.leave(MEMBER_ID, RAW_PIN_ID);

        assertThat(response.status()).isEqualTo("LEFT");
        assertThat(response.leftChatRoomIds()).isEmpty();
    }

    @Test
    void 핀이_없으면_PIN_NOT_FOUND이다() {
        given(pinRepository.findByIdForUpdate(PIN_ID)).willReturn(Optional.empty());

        assertThatThrownBy(() -> service.leave(MEMBER_ID, RAW_PIN_ID))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.PIN_NOT_FOUND);
    }

    @Test
    void 작성자가_아니면_PIN_LEAVE_FORBIDDEN이고_채팅방을_조회하지_않는다() {
        Pin pin = pinOwnedBy(MEMBER_ID);
        given(pinRepository.findByIdForUpdate(PIN_ID)).willReturn(Optional.of(pin));

        assertThatThrownBy(() -> service.leave(OTHER_MEMBER_ID, RAW_PIN_ID))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.PIN_LEAVE_FORBIDDEN);

        assertThat(pin.getPublisherStatus()).isEqualTo(PublisherStatus.STILL_HERE);
        verify(chatRoomRepository, never()).findByPin_IdAndStatusIn(any(), any());
    }

    @Test
    void pinId_형식이_잘못되면_INVALID_PIN_ID이고_핀을_조회하지_않는다() {
        assertThatThrownBy(() -> service.leave(MEMBER_ID, "not-a-uuid"))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.INVALID_PIN_ID);

        verify(pinRepository, never()).findByIdForUpdate(any());
    }
}
