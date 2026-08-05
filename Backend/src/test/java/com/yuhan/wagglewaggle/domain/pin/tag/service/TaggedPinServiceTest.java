package com.yuhan.wagglewaggle.domain.pin.tag.service;

import com.yuhan.wagglewaggle.domain.pin.dto.TaggedPlaceItem;
import com.yuhan.wagglewaggle.domain.pin.dto.TaggedPlacesResponse;
import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import com.yuhan.wagglewaggle.domain.pin.repository.PinRepository;
import com.yuhan.wagglewaggle.domain.place.entity.Place;
import com.yuhan.wagglewaggle.domain.place.repository.PlaceRepository;
import com.yuhan.wagglewaggle.domain.search.entity.SearchHistory;
import com.yuhan.wagglewaggle.domain.search.entity.SearchType;
import com.yuhan.wagglewaggle.domain.search.repository.SearchHistoryRepository;
import com.yuhan.wagglewaggle.domain.user.entity.Member;
import com.yuhan.wagglewaggle.domain.user.repository.MemberRepository;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.locationtech.jts.geom.Point;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TaggedPinServiceTest {

    @Mock private PinRepository pinRepository;
    @Mock private PlaceRepository placeRepository;
    @Mock private MemberRepository memberRepository;
    @Mock private SearchHistoryRepository searchHistoryRepository;

    private TaggedPinService taggedPinService;

    private static final Long MEMBER_ID = 42L;
    // 유효한 지도 경계(남서 < 북동, 범위 내). 중심 = (37.50, 127.03).
    private static final double SW_LAT = 37.49;
    private static final double SW_LNG = 127.02;
    private static final double NE_LAT = 37.51;
    private static final double NE_LNG = 127.04;

    @BeforeEach
    void setUp() {
        // 정규화·경계 검증은 실제 TagQueryNormalizer로 수행해 검증 로직을 그대로 시험한다.
        taggedPinService = new TaggedPinService(
                pinRepository, placeRepository, memberRepository, searchHistoryRepository,
                new TagQueryNormalizer());
    }

    // ===== 정상 흐름 =====

    @Test
    void 정상_조회시_정규화된_태그로_조회하고_장소별로_묶어_검색기록을_저장한다() {
        Member author = author(1L, BigDecimal.valueOf(92));
        // 지도 중심(37.50,127.03)에 가까운 장소 A, 상대적으로 먼 장소 B.
        Place placeA = place(10L, "카페 A", "서울 강남구 A로 1", "02-111-1111", 37.501, 127.031);
        Place placeB = place(20L, "카페 B", "서울 강남구 B로 2", "02-222-2222", 37.490, 127.020);

        // 장소 A에 핀 2개, 장소 B에 핀 1개.
        Pin pinA1 = pin(uuid(1), placeA, author, 37.5011, 127.0311);
        Pin pinA2 = pin(uuid(2), placeA, author, 37.5012, 127.0312);
        Pin pinB1 = pin(uuid(3), placeB, author, 37.4901, 127.0201);

        given(pinRepository.findActivePinsByTagWithinBounds(
                eq("카페"), any(), anyDouble(), anyDouble(), anyDouble(), anyDouble()))
                .willReturn(List.of(pinA1, pinA2, pinB1));
        given(memberRepository.findAllById(any())).willReturn(List.of(author));
        given(placeRepository.findAllById(any())).willReturn(List.of(placeA, placeB));
        given(memberRepository.getReferenceById(MEMBER_ID)).willReturn(author);

        // 앞뒤 공백·선행 '#'이 있어도 정규화되어 "카페"로 조회되어야 한다.
        TaggedPlacesResponse response = taggedPinService.searchPinsByTag(
                MEMBER_ID, "  #카페  ", SW_LAT, SW_LNG, NE_LAT, NE_LNG);

        assertThat(response.tag()).isEqualTo("카페");
        // 지도 중심에 가까운 장소 A가 먼저 온다.
        assertThat(response.places()).hasSize(2);
        TaggedPlaceItem first = response.places().get(0);
        TaggedPlaceItem second = response.places().get(1);
        assertThat(first.placeId()).isEqualTo(10L);
        assertThat(first.name()).isEqualTo("카페 A");
        assertThat(first.address()).isEqualTo("서울 강남구 A로 1");
        assertThat(first.phone()).isEqualTo("02-111-1111");
        assertThat(first.latitude()).isEqualTo(37.501);
        assertThat(first.longitude()).isEqualTo(127.031);
        assertThat(first.activePins()).hasSize(2);
        assertThat(first.activePins()).allSatisfy(activePin ->
                assertThat(activePin.viewAngle()).isEqualByComparingTo(BigDecimal.valueOf(92)));
        assertThat(second.placeId()).isEqualTo(20L);
        assertThat(second.activePins()).hasSize(1);
        assertThat(second.activePins().get(0).pinId()).isEqualTo(uuid(3));

        verify(pinRepository).findActivePinsByTagWithinBounds(
                eq("카페"), any(), anyDouble(), anyDouble(), anyDouble(), anyDouble());

        // 검색기록: search_type=TAG, place=null, keyword=정규화된 태그.
        ArgumentCaptor<SearchHistory> captor = ArgumentCaptor.forClass(SearchHistory.class);
        verify(searchHistoryRepository).save(captor.capture());
        SearchHistory saved = captor.getValue();
        assertThat(saved.getSearchType()).isEqualTo(SearchType.TAG);
        assertThat(saved.getKeyword()).isEqualTo("카페");
        assertThat(saved.getPlace()).isNull();
        verify(memberRepository).getReferenceById(MEMBER_ID);
    }

    @Test
    void 조회결과가_없으면_빈_places를_반환하고_배치조회를_건너뛰지만_검색기록은_저장한다() {
        given(pinRepository.findActivePinsByTagWithinBounds(
                eq("카페"), any(), anyDouble(), anyDouble(), anyDouble(), anyDouble()))
                .willReturn(List.of());

        TaggedPlacesResponse response = taggedPinService.searchPinsByTag(
                MEMBER_ID, "카페", SW_LAT, SW_LNG, NE_LAT, NE_LNG);

        assertThat(response.tag()).isEqualTo("카페");
        assertThat(response.places()).isEmpty();
        verify(memberRepository, never()).findAllById(any());
        verify(placeRepository, never()).findAllById(any());
        verify(searchHistoryRepository).save(any(SearchHistory.class));
    }

    // ===== 태그 검증 =====

    @Test
    void 빈_태그면_INVALID_TAG_NAME이고_조회하지_않는다() {
        assertError(() -> taggedPinService.searchPinsByTag(
                MEMBER_ID, "#", SW_LAT, SW_LNG, NE_LAT, NE_LNG), ErrorCode.INVALID_TAG_NAME);

        verify(pinRepository, never()).findActivePinsByTagWithinBounds(
                any(), any(), anyDouble(), anyDouble(), anyDouble(), anyDouble());
        verify(searchHistoryRepository, never()).save(any());
    }

    @Test
    void 태그가_최대길이를_초과하면_INVALID_TAG_NAME이다() {
        String tooLong = "가".repeat(31); // pin_tags.tag 컬럼 길이(30) 초과

        assertError(() -> taggedPinService.searchPinsByTag(
                MEMBER_ID, tooLong, SW_LAT, SW_LNG, NE_LAT, NE_LNG), ErrorCode.INVALID_TAG_NAME);

        verify(pinRepository, never()).findActivePinsByTagWithinBounds(
                any(), any(), anyDouble(), anyDouble(), anyDouble(), anyDouble());
    }

    // ===== 지도 경계 검증 =====

    @Test
    void 지도경계가_범위를_벗어나면_INVALID_MAP_RANGE이고_조회하지_않는다() {
        assertError(() -> taggedPinService.searchPinsByTag(
                MEMBER_ID, "카페", -100, SW_LNG, NE_LAT, NE_LNG), ErrorCode.INVALID_MAP_RANGE);

        verify(pinRepository, never()).findActivePinsByTagWithinBounds(
                any(), any(), anyDouble(), anyDouble(), anyDouble(), anyDouble());
        verify(searchHistoryRepository, never()).save(any());
    }

    @Test
    void 남서가_북동보다_크거나_같으면_INVALID_MAP_RANGE이다() {
        // 남서 위도(NE_LAT) >= 북동 위도(SW_LAT) 로 순서가 뒤집힌 경우
        assertError(() -> taggedPinService.searchPinsByTag(
                MEMBER_ID, "카페", NE_LAT, SW_LNG, SW_LAT, NE_LNG), ErrorCode.INVALID_MAP_RANGE);
    }

    // ===== 실패 처리 =====

    @Test
    void 핀_조회에_실패하면_TAGGED_PINS_FETCH_FAILED이고_검색기록을_저장하지_않는다() {
        given(pinRepository.findActivePinsByTagWithinBounds(
                eq("카페"), any(), anyDouble(), anyDouble(), anyDouble(), anyDouble()))
                .willThrow(new RuntimeException("DB 오류"));

        assertError(() -> taggedPinService.searchPinsByTag(
                MEMBER_ID, "카페", SW_LAT, SW_LNG, NE_LAT, NE_LNG), ErrorCode.TAGGED_PINS_FETCH_FAILED);

        verify(searchHistoryRepository, never()).save(any());
    }

    @Test
    void 검색기록_저장이_실패해도_장소목록은_정상_반환한다() {
        Member author = author(1L, BigDecimal.valueOf(92));
        Place placeA = place(10L, "카페 A", "서울 강남구 A로 1", "02-111-1111", 37.501, 127.031);
        Pin pinA1 = pin(uuid(1), placeA, author, 37.5011, 127.0311);

        given(pinRepository.findActivePinsByTagWithinBounds(
                eq("카페"), any(), anyDouble(), anyDouble(), anyDouble(), anyDouble()))
                .willReturn(List.of(pinA1));
        given(memberRepository.findAllById(any())).willReturn(List.of(author));
        given(placeRepository.findAllById(any())).willReturn(List.of(placeA));
        given(memberRepository.getReferenceById(MEMBER_ID)).willReturn(author);
        given(searchHistoryRepository.save(any())).willThrow(new RuntimeException("저장 실패"));

        TaggedPlacesResponse response = taggedPinService.searchPinsByTag(
                MEMBER_ID, "카페", SW_LAT, SW_LNG, NE_LAT, NE_LNG);

        assertThat(response.places()).hasSize(1);
        assertThat(response.places().get(0).placeId()).isEqualTo(10L);
    }

    // ===== 헬퍼 =====

    private void assertError(Runnable runnable, ErrorCode expected) {
        assertThatThrownBy(runnable::run)
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(expected);
    }

    private static UUID uuid(int last) {
        return UUID.fromString(String.format("00000000-0000-0000-0000-%012d", last));
    }

    private Pin pin(UUID id, Place place, Member author, double latitude, double longitude) {
        Point captureLocation = point(latitude, longitude);
        Pin pin = mock(Pin.class);
        given(pin.getId()).willReturn(id);
        given(pin.getPlace()).willReturn(place);
        given(pin.getMember()).willReturn(author);
        given(pin.getCaptureLocation()).willReturn(captureLocation);
        return pin;
    }

    private Place place(Long id, String name, String address, String phone,
                        double latitude, double longitude) {
        Point location = point(latitude, longitude);
        Place place = mock(Place.class);
        given(place.getId()).willReturn(id);
        given(place.getName()).willReturn(name);
        given(place.getAddressName()).willReturn(address);
        given(place.getPhone()).willReturn(phone);
        given(place.getLocation()).willReturn(location);
        return place;
    }

    private Member author(Long id, BigDecimal viewAngle) {
        Member member = mock(Member.class);
        given(member.getId()).willReturn(id);
        given(member.getViewAngle()).willReturn(viewAngle);
        return member;
    }

    private Point point(double latitude, double longitude) {
        Point point = mock(Point.class);
        given(point.getY()).willReturn(latitude);
        given(point.getX()).willReturn(longitude);
        return point;
    }
}
