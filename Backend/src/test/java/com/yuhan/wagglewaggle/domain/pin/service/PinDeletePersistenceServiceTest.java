package com.yuhan.wagglewaggle.domain.pin.service;

import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJob;
import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJobStatus;
import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJobType;
import com.yuhan.wagglewaggle.domain.blur.repository.AiBlurJobRepository;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoom;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoomStatus;
import com.yuhan.wagglewaggle.domain.chat.repository.ChatRoomRepository;
import com.yuhan.wagglewaggle.domain.pin.entity.CrowdLevel;
import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import com.yuhan.wagglewaggle.domain.pin.entity.VideoStatus;
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
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
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
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PinDeletePersistenceServiceTest {

    @Mock private PinRepository pinRepository;
    @Mock private ChatRoomRepository chatRoomRepository;
    @Mock private AiBlurJobRepository aiBlurJobRepository;

    private PinDeletePersistenceService service;

    private static final Long MEMBER_ID = 42L;
    private static final Long OTHER_MEMBER_ID = 99L;
    private static final UUID PIN_ID = UUID.fromString("11111111-2222-3333-4444-555555555555");
    private static final Instant SERVER_NOW = Instant.parse("2026-08-02T00:00:00Z");

    private static final String ORIGINAL_KEY = "pins/original/42/original.mp4";
    private static final String BLURRED_KEY = "pins/blurred/42/blurred.mp4";
    private static final String THUMBNAIL_KEY = "pins/thumbnail/42/thumb.jpg";
    private static final String PENDING_CANDIDATE_KEY = "pins/original/42/candidate.mp4";

    private static final GeometryFactory GF = new GeometryFactory(new PrecisionModel(), 4326);

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(SERVER_NOW, ZoneOffset.UTC);
        service = new PinDeletePersistenceService(pinRepository, chatRoomRepository, aiBlurJobRepository, clock);
        given(chatRoomRepository.findByPin_IdAndStatus(any(), any())).willReturn(List.of());
        given(aiBlurJobRepository.findByPinIdAndStatus(any(), any())).willReturn(List.of());
    }

    private Pin activePin() {
        Member member = Member.create("tester", AgeGroup.TWENTIES, Gender.MALE);
        ReflectionTestUtils.setField(member, "id", MEMBER_ID);
        Place place = Place.create("kakao-1", "장소", point());
        ReflectionTestUtils.setField(place, "id", 1L);
        Pin pin = Pin.create(member, place, CrowdLevel.WAGLE, point(),
                "2층 창가", "메모", ORIGINAL_KEY, SERVER_NOW.plusSeconds(3600));
        ReflectionTestUtils.setField(pin, "id", PIN_ID);
        ReflectionTestUtils.setField(pin, "videoStatus", VideoStatus.ACTIVE);
        ReflectionTestUtils.setField(pin, "blurredVideoKey", BLURRED_KEY);
        ReflectionTestUtils.setField(pin, "thumbnailKey", THUMBNAIL_KEY);
        return pin;
    }

    private ChatRoom activeChatRoom(Long id) {
        ChatRoom room = ChatRoom.create(
                activePin(), org.mockito.Mockito.mock(Member.class), UUID.randomUUID());
        ReflectionTestUtils.setField(room, "id", id);
        return room;
    }

    private static Point point() {
        return GF.createPoint(new Coordinate(127.0, 37.5));
    }

    @Test
    void 정상_삭제하면_deleted_at을_기록하고_ACTIVE_채팅방을_LEFT로_종료한다() {
        Pin pin = activePin();
        given(pinRepository.findByIdForDelete(PIN_ID)).willReturn(Optional.of(pin));
        ChatRoom room1 = activeChatRoom(1L);
        ChatRoom room2 = activeChatRoom(2L);
        given(chatRoomRepository.findByPin_IdAndStatus(PIN_ID, ChatRoomStatus.ACTIVE))
                .willReturn(List.of(room1, room2));
        AiBlurJob pendingJob = AiBlurJob.create(PIN_ID, PENDING_CANDIDATE_KEY, AiBlurJobType.VIDEO_REPLACEMENT);
        given(aiBlurJobRepository.findByPinIdAndStatus(PIN_ID, AiBlurJobStatus.PENDING))
                .willReturn(List.of(pendingJob));

        PinDeletePersistenceService.Result result = service.apply(PIN_ID, MEMBER_ID);

        // 소프트 삭제 시각 = 서버 현재 시각
        assertThat(pin.isDeleted()).isTrue();
        assertThat(pin.getDeletedAt()).isEqualTo(SERVER_NOW);
        assertThat(result.deletedAt()).isEqualTo(SERVER_NOW);
        // video_status·영상 키는 변경하지 않는다
        assertThat(pin.getVideoStatus()).isEqualTo(VideoStatus.ACTIVE);
        assertThat(pin.getOriginalVideoKey()).isEqualTo(ORIGINAL_KEY);
        // ACTIVE 채팅방은 LEFT로 종료되고 ID가 수집된다
        assertThat(room1.getStatus()).isEqualTo(ChatRoomStatus.LEFT);
        assertThat(room2.getStatus()).isEqualTo(ChatRoomStatus.LEFT);
        assertThat(result.closedChatRoomIds()).containsExactly(1L, 2L);
        // 정리 대상: 핀 영상 3종 + PENDING 작업 후보 원본
        assertThat(result.cleanupKeys())
                .containsExactlyInAnyOrder(ORIGINAL_KEY, BLURRED_KEY, THUMBNAIL_KEY, PENDING_CANDIDATE_KEY);
    }

    @Test
    void 종료할_ACTIVE_채팅방이_없으면_closedChatRoomIds는_빈_배열이다() {
        Pin pin = activePin();
        given(pinRepository.findByIdForDelete(PIN_ID)).willReturn(Optional.of(pin));

        PinDeletePersistenceService.Result result = service.apply(PIN_ID, MEMBER_ID);

        assertThat(pin.isDeleted()).isTrue();
        assertThat(result.closedChatRoomIds()).isEmpty();
    }

    @Test
    void 작성자가_아니면_PIN_DELETE_FORBIDDEN이고_삭제하지_않는다() {
        Pin pin = activePin();
        given(pinRepository.findByIdForDelete(PIN_ID)).willReturn(Optional.of(pin));

        assertThatThrownBy(() -> service.apply(PIN_ID, OTHER_MEMBER_ID))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.PIN_DELETE_FORBIDDEN);

        assertThat(pin.isDeleted()).isFalse();
        verify(chatRoomRepository, never()).findByPin_IdAndStatus(any(), any());
    }

    @Test
    void 핀이_없으면_PIN_NOT_FOUND이다() {
        given(pinRepository.findByIdForDelete(PIN_ID)).willReturn(Optional.empty());

        assertThatThrownBy(() -> service.apply(PIN_ID, MEMBER_ID))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.PIN_NOT_FOUND);
    }

    @Test
    void 이미_삭제된_핀을_다시_삭제하면_최초_시각을_유지하고_빈_목록을_반환한다() {
        Instant firstDeletedAt = Instant.parse("2026-07-22T04:00:00Z");
        Pin pin = activePin();
        ReflectionTestUtils.setField(pin, "deletedAt", firstDeletedAt);
        given(pinRepository.findByIdForDelete(PIN_ID)).willReturn(Optional.of(pin));

        PinDeletePersistenceService.Result result = service.apply(PIN_ID, MEMBER_ID);

        // deleted_at을 갱신하지 않고 최초 삭제 시각을 반환한다
        assertThat(result.deletedAt()).isEqualTo(firstDeletedAt);
        assertThat(pin.getDeletedAt()).isEqualTo(firstDeletedAt);
        // 재요청에서는 채팅방·정리 대상을 다시 처리하지 않는다
        assertThat(result.closedChatRoomIds()).isEmpty();
        assertThat(result.cleanupKeys()).isEmpty();
        verify(chatRoomRepository, never()).findByPin_IdAndStatus(any(), any());
        verify(aiBlurJobRepository, never()).findByPinIdAndStatus(any(), any());
    }
}
