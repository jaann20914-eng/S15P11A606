package com.yuhan.wagglewaggle.domain.pin.service;

import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoomStatus;
import com.yuhan.wagglewaggle.domain.chat.repository.ChatRoomRepository;
import com.yuhan.wagglewaggle.domain.pin.dto.ChatRequestState;
import com.yuhan.wagglewaggle.domain.pin.dto.PinDetail;
import com.yuhan.wagglewaggle.domain.pin.dto.PinDetailView;
import com.yuhan.wagglewaggle.domain.pin.dto.VideoAccessLevel;
import com.yuhan.wagglewaggle.domain.pin.entity.CrowdLevel;
import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import com.yuhan.wagglewaggle.domain.pin.entity.PinTag;
import com.yuhan.wagglewaggle.domain.pin.entity.VideoStatus;
import com.yuhan.wagglewaggle.domain.pin.repository.PinEvaluationRepository;
import com.yuhan.wagglewaggle.domain.pin.repository.PinRepository;
import com.yuhan.wagglewaggle.domain.pin.repository.PinTagRepository;
import com.yuhan.wagglewaggle.domain.pin.repository.PinUnlockRepository;
import com.yuhan.wagglewaggle.domain.place.entity.Place;
import com.yuhan.wagglewaggle.domain.user.entity.AgeGroup;
import com.yuhan.wagglewaggle.domain.user.entity.Gender;
import com.yuhan.wagglewaggle.domain.user.entity.Member;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class PinDetailQueryServiceTest {

    @Mock private PinRepository pinRepository;
    @Mock private PinTagRepository pinTagRepository;
    @Mock private PinUnlockRepository pinUnlockRepository;
    @Mock private PinEvaluationRepository pinEvaluationRepository;
    @Mock private ChatRoomRepository chatRoomRepository;

    private PinDetailQueryService service;

    private static final UUID PIN_ID = UUID.fromString("11111111-2222-3333-4444-555555555555");
    private static final Long AUTHOR_ID = 42L;
    private static final Long VIEWER_ID = 99L;
    private static final Long PLACE_ID = 7L;
    private static final double PLACE_LAT = 37.500000;
    private static final double PLACE_LNG = 127.030000;
    private static final String BLURRED_KEY = "pins/blurred/42/blurred.mp4";
    private static final String THUMBNAIL_KEY = "pins/thumbnail/42/thumb.jpg";

    private static final GeometryFactory GF = new GeometryFactory(new PrecisionModel(), 4326);

    @BeforeEach
    void setUp() {
        service = new PinDetailQueryService(
                pinRepository, pinTagRepository, pinUnlockRepository,
                pinEvaluationRepository, chatRoomRepository);
    }

    /** AUTHOR_ID 소유의, 조회 가능한 ACTIVE 핀을 만든다. */
    private Pin activePin() {
        Member member = Member.create("author", AgeGroup.TWENTIES, Gender.FEMALE);
        ReflectionTestUtils.setField(member, "id", AUTHOR_ID);
        ReflectionTestUtils.setField(member, "viewAngle", java.math.BigDecimal.valueOf(120));

        // 위도=getY, 경도=getX 이므로 좌표는 (경도, 위도) 순으로 생성한다.
        Point placePoint = GF.createPoint(new Coordinate(PLACE_LNG, PLACE_LAT));
        Place place = Place.create("kakao-1", "테스트 카페", placePoint);
        ReflectionTestUtils.setField(place, "id", PLACE_ID);

        Pin pin = Pin.create(
                member, place, CrowdLevel.WAGLE,
                GF.createPoint(new Coordinate(127.0, 37.5)),
                "2층 창가", "조용해요", "pins/original/42/original.mp4",
                Instant.now().plus(Duration.ofMinutes(30)));
        ReflectionTestUtils.setField(pin, "id", PIN_ID);
        ReflectionTestUtils.setField(pin, "videoStatus", VideoStatus.ACTIVE);
        ReflectionTestUtils.setField(pin, "createdAt", Instant.parse("2026-08-01T00:00:00Z"));
        ReflectionTestUtils.setField(pin, "blurredVideoKey", BLURRED_KEY);
        ReflectionTestUtils.setField(pin, "thumbnailKey", THUMBNAIL_KEY);
        return pin;
    }

    /** AUTHOR_ID 소유의, 이미 만료된 ACTIVE 핀을 만든다(expiresAt이 과거). */
    private Pin expiredPin() {
        Pin pin = activePin();
        ReflectionTestUtils.setField(pin, "expiresAt", Instant.now().minus(Duration.ofMinutes(1)));
        return pin;
    }

    private PinTag pinTag(String tag) {
        return PinTag.create(null, tag);
    }

    // ---------------------------------------------------------------------
    // 기본 데이터 매핑 (getPinDetail(UUID, memberId)의 detail 부분)
    // 작성자(AUTHOR_ID)로 조회해 구매·평가 조회 없이 매핑만 검증한다.
    // ---------------------------------------------------------------------

    @Nested
    class 기본_데이터_매핑 {

        @Test
        void 조회_가능한_핀이_없으면_PIN_NOT_FOUND() {
            given(pinRepository.findActivePinDetailByIdIncludingExpired(any())).willReturn(Optional.empty());

            assertThatThrownBy(() -> service.getPinDetail(PIN_ID, AUTHOR_ID))
                    .isInstanceOf(CustomException.class)
                    .extracting("errorCode").isEqualTo(ErrorCode.PIN_NOT_FOUND);
            verifyNoInteractions(pinTagRepository);
        }

        @Test
        void 조회_가능한_핀의_기본_데이터와_좌표_태그를_반환한다() {
            given(pinRepository.findActivePinDetailByIdIncludingExpired(any())).willReturn(Optional.of(activePin()));
            given(pinTagRepository.findByPin_IdIn(anyCollection())).willReturn(List.of(
                    pinTag("카페"), pinTag("조용함")));

            PinDetail detail = service.getPinDetail(PIN_ID, AUTHOR_ID).detail();

            assertThat(detail.pinId()).isEqualTo(PIN_ID);
            assertThat(detail.authorNickname()).isEqualTo("author");
            assertThat(detail.authorViewAngle()).isEqualByComparingTo(java.math.BigDecimal.valueOf(120));
            assertThat(detail.createdAt()).isEqualTo(Instant.parse("2026-08-01T00:00:00Z"));
            assertThat(detail.placeId()).isEqualTo(PLACE_ID);
            assertThat(detail.kakaoPlaceId()).isEqualTo("kakao-1");
            assertThat(detail.placeName()).isEqualTo("테스트 카페");
            assertThat(detail.latitude()).isEqualTo(PLACE_LAT);
            assertThat(detail.longitude()).isEqualTo(PLACE_LNG);
            assertThat(detail.crowdLevel()).isEqualTo(CrowdLevel.WAGLE);
            assertThat(detail.detailLocation()).isEqualTo("2층 창가");
            assertThat(detail.memo()).isEqualTo("조용해요");
            assertThat(detail.tags()).containsExactly("카페", "조용함");
            assertThat(detail.blurredVideoKey()).isEqualTo(BLURRED_KEY);
            assertThat(detail.thumbnailKey()).isEqualTo(THUMBNAIL_KEY);
            assertThat(detail.expiresAt()).isNotNull();
        }

        @Test
        void 태그가_없으면_빈_목록을_반환한다() {
            given(pinRepository.findActivePinDetailByIdIncludingExpired(any())).willReturn(Optional.of(activePin()));
            given(pinTagRepository.findByPin_IdIn(anyCollection())).willReturn(List.of());

            PinDetail detail = service.getPinDetail(PIN_ID, AUTHOR_ID).detail();

            assertThat(detail.tags()).isEmpty();
        }
    }

    // ---------------------------------------------------------------------
    // 만료 기준 접근 판정 (미만료는 누구나 / 만료는 작성자만)
    // ---------------------------------------------------------------------

    @Nested
    class 만료_접근_판정 {

        @Test
        void 만료된_핀을_작성자가_조회하면_정상_조회된다() {
            given(pinRepository.findActivePinDetailByIdIncludingExpired(any()))
                    .willReturn(Optional.of(expiredPin()));
            lenient().when(pinTagRepository.findByPin_IdIn(anyCollection())).thenReturn(List.of());

            PinDetailView view = service.getPinDetail(PIN_ID, AUTHOR_ID);

            assertThat(view.detail().pinId()).isEqualTo(PIN_ID);
            assertThat(view.access().videoAccess()).isEqualTo(VideoAccessLevel.OWNER);
        }

        @Test
        void 만료된_핀을_비작성자가_조회하면_PIN_NOT_FOUND() {
            given(pinRepository.findActivePinDetailByIdIncludingExpired(any()))
                    .willReturn(Optional.of(expiredPin()));

            assertThatThrownBy(() -> service.getPinDetail(PIN_ID, VIEWER_ID))
                    .isInstanceOf(CustomException.class)
                    .extracting("errorCode").isEqualTo(ErrorCode.PIN_NOT_FOUND);
            verifyNoInteractions(pinTagRepository);
        }

        @Test
        void 만료된_핀을_비로그인_사용자가_조회하면_PIN_NOT_FOUND() {
            given(pinRepository.findActivePinDetailByIdIncludingExpired(any()))
                    .willReturn(Optional.of(expiredPin()));

            assertThatThrownBy(() -> service.getPinDetail(PIN_ID, null))
                    .isInstanceOf(CustomException.class)
                    .extracting("errorCode").isEqualTo(ErrorCode.PIN_NOT_FOUND);
            verifyNoInteractions(pinTagRepository);
        }

        @Test
        void 미만료_핀은_비작성자도_조회할_수_있다() {
            given(pinRepository.findActivePinDetailByIdIncludingExpired(any()))
                    .willReturn(Optional.of(activePin()));
            lenient().when(pinTagRepository.findByPin_IdIn(anyCollection())).thenReturn(List.of());
            given(pinUnlockRepository.existsByPin_IdAndMember_Id(PIN_ID, VIEWER_ID)).willReturn(false);
            given(chatRoomRepository.findStatusByPinIdAndRequesterId(PIN_ID, VIEWER_ID))
                    .willReturn(Optional.empty());

            PinDetailView view = service.getPinDetail(PIN_ID, VIEWER_ID);

            assertThat(view.detail().pinId()).isEqualTo(PIN_ID);
            assertThat(view.access().videoAccess()).isEqualTo(VideoAccessLevel.PREVIEW_BLURRED);
        }
    }

    // ---------------------------------------------------------------------
    // 현재 사용자 기준 접근 정보 (getPinDetail(UUID, memberId))
    // ---------------------------------------------------------------------

    @Nested
    class 접근_정보_조회 {

        @BeforeEach
        void stubBasicLoad() {
            given(pinRepository.findActivePinDetailByIdIncludingExpired(any())).willReturn(Optional.of(activePin()));
            lenient().when(pinTagRepository.findByPin_IdIn(anyCollection())).thenReturn(List.of());
        }

        @Test
        void 작성자는_OWNER이고_구매_평가_조회를_하지_않는다() {
            PinDetailView view = service.getPinDetail(PIN_ID, AUTHOR_ID);

            assertThat(view.access().videoAccess()).isEqualTo(VideoAccessLevel.OWNER);
            assertThat(view.access().isEvaluated()).isNull();
            // 작성자면 구매 여부·평가 여부를 조회하지 않는다.
            verifyNoInteractions(pinUnlockRepository);
            verifyNoInteractions(pinEvaluationRepository);
        }

        @Test
        void 작성자는_PinUnlock이_있어도_OWNER가_우선한다() {
            // 작성자 판정을 구매 여부보다 우선하므로 unlock 조회 자체를 하지 않는다.
            PinDetailView view = service.getPinDetail(PIN_ID, AUTHOR_ID);

            assertThat(view.access().videoAccess()).isEqualTo(VideoAccessLevel.OWNER);
            verify(pinUnlockRepository, never()).existsByPin_IdAndMember_Id(any(), any());
        }

        @Test
        void 구매자는_UNLOCKED다() {
            given(pinUnlockRepository.existsByPin_IdAndMember_Id(PIN_ID, VIEWER_ID)).willReturn(true);
            given(pinEvaluationRepository.existsByPin_IdAndMember_Id(PIN_ID, VIEWER_ID)).willReturn(false);
            given(chatRoomRepository.findStatusByPinIdAndRequesterId(PIN_ID, VIEWER_ID))
                    .willReturn(Optional.empty());

            PinDetailView view = service.getPinDetail(PIN_ID, VIEWER_ID);

            assertThat(view.access().videoAccess()).isEqualTo(VideoAccessLevel.UNLOCKED);
        }

        @Test
        void 미구매자는_PREVIEW_BLURRED다() {
            given(pinUnlockRepository.existsByPin_IdAndMember_Id(PIN_ID, VIEWER_ID)).willReturn(false);
            given(chatRoomRepository.findStatusByPinIdAndRequesterId(PIN_ID, VIEWER_ID))
                    .willReturn(Optional.empty());

            PinDetailView view = service.getPinDetail(PIN_ID, VIEWER_ID);

            assertThat(view.access().videoAccess()).isEqualTo(VideoAccessLevel.PREVIEW_BLURRED);
            assertThat(view.access().isEvaluated()).isNull();
            // PREVIEW_BLURRED이면 평가 조회를 하지 않는다.
            verifyNoInteractions(pinEvaluationRepository);
        }

        @Test
        void UNLOCKED_평가_완료면_isEvaluated_true() {
            given(pinUnlockRepository.existsByPin_IdAndMember_Id(PIN_ID, VIEWER_ID)).willReturn(true);
            given(pinEvaluationRepository.existsByPin_IdAndMember_Id(PIN_ID, VIEWER_ID)).willReturn(true);
            given(chatRoomRepository.findStatusByPinIdAndRequesterId(PIN_ID, VIEWER_ID))
                    .willReturn(Optional.empty());

            PinDetailView view = service.getPinDetail(PIN_ID, VIEWER_ID);

            assertThat(view.access().isEvaluated()).isTrue();
        }

        @Test
        void UNLOCKED_평가_미완료면_isEvaluated_false() {
            given(pinUnlockRepository.existsByPin_IdAndMember_Id(PIN_ID, VIEWER_ID)).willReturn(true);
            given(pinEvaluationRepository.existsByPin_IdAndMember_Id(PIN_ID, VIEWER_ID)).willReturn(false);
            given(chatRoomRepository.findStatusByPinIdAndRequesterId(PIN_ID, VIEWER_ID))
                    .willReturn(Optional.empty());

            PinDetailView view = service.getPinDetail(PIN_ID, VIEWER_ID);

            assertThat(view.access().isEvaluated()).isFalse();
        }

        @Test
        void 채팅방이_없으면_NONE이고_UNLOCKED면_canRequestChat_true() {
            given(pinUnlockRepository.existsByPin_IdAndMember_Id(PIN_ID, VIEWER_ID)).willReturn(true);
            given(pinEvaluationRepository.existsByPin_IdAndMember_Id(PIN_ID, VIEWER_ID)).willReturn(false);
            given(chatRoomRepository.findStatusByPinIdAndRequesterId(PIN_ID, VIEWER_ID))
                    .willReturn(Optional.empty());

            PinDetailView view = service.getPinDetail(PIN_ID, VIEWER_ID);

            assertThat(view.access().chatRequestState()).isEqualTo(ChatRequestState.NONE);
            assertThat(view.access().canRequestChat()).isTrue();
        }

        @Test
        void 채팅방_ACTIVE면_ACTIVE이고_canRequestChat_false() {
            given(pinUnlockRepository.existsByPin_IdAndMember_Id(PIN_ID, VIEWER_ID)).willReturn(true);
            given(pinEvaluationRepository.existsByPin_IdAndMember_Id(PIN_ID, VIEWER_ID)).willReturn(false);
            given(chatRoomRepository.findStatusByPinIdAndRequesterId(PIN_ID, VIEWER_ID))
                    .willReturn(Optional.of(ChatRoomStatus.ACTIVE));

            PinDetailView view = service.getPinDetail(PIN_ID, VIEWER_ID);

            assertThat(view.access().chatRequestState()).isEqualTo(ChatRequestState.ACTIVE);
            assertThat(view.access().canRequestChat()).isFalse();
        }

        @Test
        void 채팅방_REFUSED면_CLOSED이고_canRequestChat_false() {
            given(pinUnlockRepository.existsByPin_IdAndMember_Id(PIN_ID, VIEWER_ID)).willReturn(true);
            given(pinEvaluationRepository.existsByPin_IdAndMember_Id(PIN_ID, VIEWER_ID)).willReturn(false);
            given(chatRoomRepository.findStatusByPinIdAndRequesterId(PIN_ID, VIEWER_ID))
                    .willReturn(Optional.of(ChatRoomStatus.REFUSED));

            PinDetailView view = service.getPinDetail(PIN_ID, VIEWER_ID);

            assertThat(view.access().chatRequestState()).isEqualTo(ChatRequestState.CLOSED);
            assertThat(view.access().canRequestChat()).isFalse();
        }

        @Test
        void 채팅방_LEFT면_CLOSED이고_canRequestChat_false() {
            given(pinUnlockRepository.existsByPin_IdAndMember_Id(PIN_ID, VIEWER_ID)).willReturn(true);
            given(pinEvaluationRepository.existsByPin_IdAndMember_Id(PIN_ID, VIEWER_ID)).willReturn(false);
            given(chatRoomRepository.findStatusByPinIdAndRequesterId(PIN_ID, VIEWER_ID))
                    .willReturn(Optional.of(ChatRoomStatus.LEFT));

            PinDetailView view = service.getPinDetail(PIN_ID, VIEWER_ID);

            assertThat(view.access().chatRequestState()).isEqualTo(ChatRequestState.CLOSED);
            assertThat(view.access().canRequestChat()).isFalse();
        }

        @Test
        void OWNER는_NONE이어도_canRequestChat_false() {
            PinDetailView view = service.getPinDetail(PIN_ID, AUTHOR_ID);

            assertThat(view.access().chatRequestState()).isEqualTo(ChatRequestState.NONE);
            assertThat(view.access().canRequestChat()).isFalse();
        }

        @Test
        void PREVIEW_BLURRED는_NONE이어도_canRequestChat_false() {
            given(pinUnlockRepository.existsByPin_IdAndMember_Id(PIN_ID, VIEWER_ID)).willReturn(false);
            given(chatRoomRepository.findStatusByPinIdAndRequesterId(PIN_ID, VIEWER_ID))
                    .willReturn(Optional.empty());

            PinDetailView view = service.getPinDetail(PIN_ID, VIEWER_ID);

            assertThat(view.access().videoAccess()).isEqualTo(VideoAccessLevel.PREVIEW_BLURRED);
            assertThat(view.access().chatRequestState()).isEqualTo(ChatRequestState.NONE);
            assertThat(view.access().canRequestChat()).isFalse();
        }
    }

    // ---------------------------------------------------------------------
    // 순수 판정 로직 (채팅 상태 매핑 · canRequestChat)
    // PENDING/ACTIVE/CLOSED 매핑 분기를 계약 수준에서 검증한다.
    // ---------------------------------------------------------------------

    @Nested
    class 판정_로직 {

        @Test
        void ChatRoomStatus_매핑() {
            assertThat(PinDetailQueryService.toChatRequestState(ChatRoomStatus.PENDING))
                    .isEqualTo(ChatRequestState.PENDING);
            assertThat(PinDetailQueryService.toChatRequestState(ChatRoomStatus.ACTIVE))
                    .isEqualTo(ChatRequestState.ACTIVE);
            assertThat(PinDetailQueryService.toChatRequestState(ChatRoomStatus.REFUSED))
                    .isEqualTo(ChatRequestState.CLOSED);
            assertThat(PinDetailQueryService.toChatRequestState(ChatRoomStatus.LEFT))
                    .isEqualTo(ChatRequestState.CLOSED);
        }

        @Test
        void canRequestChat는_UNLOCKED_비작성자_NONE에서만_true() {
            assertThat(PinDetailQueryService.canRequestChat(
                    VideoAccessLevel.UNLOCKED, false, ChatRequestState.NONE)).isTrue();
        }

        @Test
        void canRequestChat는_PENDING_ACTIVE_CLOSED에서_false() {
            assertThat(PinDetailQueryService.canRequestChat(
                    VideoAccessLevel.UNLOCKED, false, ChatRequestState.PENDING)).isFalse();
            assertThat(PinDetailQueryService.canRequestChat(
                    VideoAccessLevel.UNLOCKED, false, ChatRequestState.ACTIVE)).isFalse();
            assertThat(PinDetailQueryService.canRequestChat(
                    VideoAccessLevel.UNLOCKED, false, ChatRequestState.CLOSED)).isFalse();
        }

        @Test
        void canRequestChat는_OWNER_PREVIEW_BLURRED에서_false() {
            assertThat(PinDetailQueryService.canRequestChat(
                    VideoAccessLevel.OWNER, true, ChatRequestState.NONE)).isFalse();
            assertThat(PinDetailQueryService.canRequestChat(
                    VideoAccessLevel.PREVIEW_BLURRED, false, ChatRequestState.NONE)).isFalse();
        }
    }
}
