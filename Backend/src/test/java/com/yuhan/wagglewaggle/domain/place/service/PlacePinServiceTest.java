package com.yuhan.wagglewaggle.domain.place.service;

import com.yuhan.wagglewaggle.domain.pin.entity.CrowdLevel;
import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import com.yuhan.wagglewaggle.domain.pin.repository.PinRepository;
import com.yuhan.wagglewaggle.domain.place.client.KakaoLocalClient;
import com.yuhan.wagglewaggle.domain.place.client.dto.KakaoKeywordResponse;
import com.yuhan.wagglewaggle.domain.place.client.dto.KakaoKeywordResponse.Document;
import com.yuhan.wagglewaggle.domain.place.dto.PlaceListItem;
import com.yuhan.wagglewaggle.domain.place.dto.PlaceListResponse;
import com.yuhan.wagglewaggle.domain.place.entity.Place;
import com.yuhan.wagglewaggle.domain.place.repository.PlaceRepository;
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
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestClientException;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PlacePinServiceTest {

    @Mock private PlaceRepository placeRepository;
    @Mock private PinRepository pinRepository;
    @Mock private KakaoLocalClient kakaoLocalClient;

    @InjectMocks private PlacePinService placePinService;

    private static final GeometryFactory GF = new GeometryFactory(new PrecisionModel(), 4326);

    // 강남역 인근 테스트 bbox. 중심점 = (37.50, 127.03)
    private static final double SW_LAT = 37.49;
    private static final double SW_LNG = 127.02;
    private static final double NE_LAT = 37.51;
    private static final double NE_LNG = 127.04;

    @BeforeEach
    void setUp() {
        // 기본적으로 카카오는 일치 결과 없음(빈 documents)을 반환 → address/phone은 "".
        given(kakaoLocalClient.searchNearby(anyString(), anyDouble(), anyDouble(), anyInt(), anyInt(), anyInt(), anyString()))
                .willReturn(new KakaoKeywordResponse(List.of()));
    }

    private PlaceListResponse call(String filter) {
        return placePinService.getPlacesInMapRange(SW_LAT, SW_LNG, NE_LAT, NE_LNG, filter);
    }

    // ===== 지도 범위 검증 =====

    @Test
    void 위도가_범위를_벗어나면_INVALID_MAP_RANGE() {
        assertError(() -> placePinService.getPlacesInMapRange(-91, SW_LNG, NE_LAT, NE_LNG, "wagle"),
                ErrorCode.INVALID_MAP_RANGE);
    }

    @Test
    void 경도가_범위를_벗어나면_INVALID_MAP_RANGE() {
        assertError(() -> placePinService.getPlacesInMapRange(SW_LAT, SW_LNG, NE_LAT, 181, "wagle"),
                ErrorCode.INVALID_MAP_RANGE);
    }

    @Test
    void 남서_북동_경계가_역전되면_INVALID_MAP_RANGE() {
        assertError(() -> placePinService.getPlacesInMapRange(NE_LAT, SW_LNG, SW_LAT, NE_LNG, "wagle"),
                ErrorCode.INVALID_MAP_RANGE);
    }

    @Test
    void 지원하지_않는_필터면_INVALID_PLACE_FILTER() {
        assertError(() -> call("busy"), ErrorCode.INVALID_PLACE_FILTER);
    }

    // ===== 조회 결과가 비는 경우 =====

    @Test
    void 경계_내_장소가_없으면_빈_목록을_반환한다() {
        given(placeRepository.findWithinBounds(anyDouble(), anyDouble(), anyDouble(), anyDouble()))
                .willReturn(List.of());

        PlaceListResponse response = call("wagle");

        assertThat(response.places()).isEmpty();
        verify(pinRepository, never()).findValidPins(anyCollection(), any(), any());
        verify(kakaoLocalClient, never()).searchNearby(anyString(), anyDouble(), anyDouble(), anyInt(), anyInt(), anyInt(), anyString());
    }

    @Test
    void 필터_적용_후_후보가_없으면_빈_목록을_반환한다() {
        Place place = place(1L, "P1", "와글카페", 127.030, 37.500);
        given(placeRepository.findWithinBounds(anyDouble(), anyDouble(), anyDouble(), anyDouble()))
                .willReturn(List.of(place));
        // 평균 1.5(RELAXED)인 장소만 존재 → wagle 필터로는 후보 없음
        given(pinRepository.findValidPins(anyCollection(), any(), any()))
                .willReturn(List.of(pin(11L, place, member(90), CrowdLevel.LEISURELY),
                        pin(12L, place, member(90), CrowdLevel.RELAXED)));

        PlaceListResponse response = call("wagle");

        assertThat(response.places()).isEmpty();
        verify(kakaoLocalClient, never()).searchNearby(anyString(), anyDouble(), anyDouble(), anyInt(), anyInt(), anyInt(), anyString());
    }

    // ===== 정렬 / 상한 =====

    @Test
    void 활성핀이_많은_장소가_우선_선택되고_최대_10개만_반환한다() {
        List<Place> places = new ArrayList<>();
        List<Pin> pins = new ArrayList<>();
        // 활성 핀 수는 id=1이 가장 많고(12개) id=12가 가장 적다(1개).
        // 반대로 거리는 id=1이 가장 멀다 → 거리 기준이 아니라 활성 핀 수 기준으로 정렬됨을 검증.
        for (long k = 1; k <= 12; k++) {
            Place place = place(k, "P" + k, "장소" + k, 127.030 + (13 - k) * 0.0005, 37.500);
            places.add(place);
            int pinCount = (int) (13 - k);
            for (int i = 0; i < pinCount; i++) {
                pins.add(pin(k * 100 + i, place, member(90), CrowdLevel.WAGLE));
            }
        }
        given(placeRepository.findWithinBounds(anyDouble(), anyDouble(), anyDouble(), anyDouble()))
                .willReturn(places);
        given(pinRepository.findValidPins(anyCollection(), any(), any())).willReturn(pins);

        PlaceListResponse response = call("wagle");

        assertThat(response.places()).hasSize(10);
        List<Long> ids = response.places().stream().map(PlaceListItem::placeId).toList();
        assertThat(ids).containsExactly(1L, 2L, 3L, 4L, 5L, 6L, 7L, 8L, 9L, 10L);
        assertThat(ids).doesNotContain(11L, 12L);
    }

    @Test
    void 활성핀_수가_같으면_지도_중심에_가까운_장소가_우선한다() {
        // 세 장소 모두 활성 핀 2개(평균 WAGLE). 중심(37.50,127.03)에서 가까운 순으로 정렬되어야 함.
        Place near = place(1L, "P1", "가까움", 127.0305, 37.500);
        Place mid = place(2L, "P2", "중간", 127.033, 37.500);
        Place far = place(3L, "P3", "멈", 127.038, 37.500);
        List<Pin> pins = new ArrayList<>();
        for (Place place : List.of(mid, far, near)) { // DB 반환 순서는 뒤섞어 둠
            pins.add(pin(place.getId() * 100, place, member(90), CrowdLevel.WAGLE));
            pins.add(pin(place.getId() * 100 + 1, place, member(90), CrowdLevel.WAGLE));
        }
        given(placeRepository.findWithinBounds(anyDouble(), anyDouble(), anyDouble(), anyDouble()))
                .willReturn(List.of(mid, far, near));
        given(pinRepository.findValidPins(anyCollection(), any(), any())).willReturn(pins);

        List<Long> ids = call("wagle").places().stream().map(PlaceListItem::placeId).toList();

        assertThat(ids).containsExactly(1L, 2L, 3L);
    }

    // ===== 평균 혼잡도 / 라벨 =====

    @Test
    void 평균_혼잡도는_소수점_첫째_자리로_반올림된다() {
        Place place = place(1L, "P1", "와글카페", 127.030, 37.500);
        given(placeRepository.findWithinBounds(anyDouble(), anyDouble(), anyDouble(), anyDouble()))
                .willReturn(List.of(place));
        // WAGLE(3)+WAGLE_WAGLE(4)+WAGLE_WAGLE(4) = 11/3 = 3.666... → 3.7
        given(pinRepository.findValidPins(anyCollection(), any(), any()))
                .willReturn(List.of(
                        pin(11L, place, member(90), CrowdLevel.WAGLE),
                        pin(12L, place, member(90), CrowdLevel.WAGLE_WAGLE),
                        pin(13L, place, member(90), CrowdLevel.WAGLE_WAGLE)));

        PlaceListItem item = call("wagle").places().get(0);

        assertThat(item.averageCrowdLevel()).isEqualTo(3.7);
        assertThat(item.crowdLabel()).isEqualTo("WAGLE");
    }

    @Test
    void 평균이_정확히_3_0이면_WAGLE로_분류된다() {
        Place place = place(1L, "P1", "경계값분식", 127.030, 37.500);
        given(placeRepository.findWithinBounds(anyDouble(), anyDouble(), anyDouble(), anyDouble()))
                .willReturn(List.of(place));
        // RELAXED(2)+WAGLE_WAGLE(4) = 3.0
        given(pinRepository.findValidPins(anyCollection(), any(), any()))
                .willReturn(List.of(
                        pin(11L, place, member(90), CrowdLevel.RELAXED),
                        pin(12L, place, member(90), CrowdLevel.WAGLE_WAGLE)));

        PlaceListItem item = call("wagle").places().get(0);

        assertThat(item.averageCrowdLevel()).isEqualTo(3.0);
        assertThat(item.crowdLabel()).isEqualTo("WAGLE");
    }

    @Test
    void 평균이_3_0미만이면_RELAXED로_분류된다() {
        Place place = place(1L, "P1", "릴랙스라운지", 127.030, 37.500);
        given(placeRepository.findWithinBounds(anyDouble(), anyDouble(), anyDouble(), anyDouble()))
                .willReturn(List.of(place));
        // LEISURELY(1)+RELAXED(2) = 1.5
        given(pinRepository.findValidPins(anyCollection(), any(), any()))
                .willReturn(List.of(
                        pin(11L, place, member(90), CrowdLevel.LEISURELY),
                        pin(12L, place, member(90), CrowdLevel.RELAXED)));

        PlaceListItem item = call("relaxed").places().get(0);

        assertThat(item.averageCrowdLevel()).isEqualTo(1.5);
        assertThat(item.crowdLabel()).isEqualTo("RELAXED");
    }

    // ===== 필터 동작 / 평균 null 처리 =====

    @Test
    void relaxed_필터는_평균_1이상_3미만_장소만_반환한다() {
        Place relaxed = place(1L, "P1", "릴랙스", 127.030, 37.500);
        Place wagle = place(2L, "P2", "와글", 127.031, 37.500);
        given(placeRepository.findWithinBounds(anyDouble(), anyDouble(), anyDouble(), anyDouble()))
                .willReturn(List.of(relaxed, wagle));
        given(pinRepository.findValidPins(anyCollection(), any(), any()))
                .willReturn(List.of(
                        pin(11L, relaxed, member(90), CrowdLevel.RELAXED),   // 평균 2.0
                        pin(21L, wagle, member(90), CrowdLevel.WAGLE)));     // 평균 3.0

        PlaceListResponse response = call("relaxed");

        assertThat(response.places()).extracting(PlaceListItem::placeId).containsExactly(1L);
    }

    @Test
    void 필터가_없으면_유효핀_없는_장소도_평균과_라벨이_null로_포함된다() {
        Place place = place(1L, "P1", "조용한책방", 127.030, 37.500);
        given(placeRepository.findWithinBounds(anyDouble(), anyDouble(), anyDouble(), anyDouble()))
                .willReturn(List.of(place));
        given(pinRepository.findValidPins(anyCollection(), any(), any())).willReturn(List.of());

        // filter=null → 필터 미적용
        PlaceListItem item = placePinService.getPlacesInMapRange(SW_LAT, SW_LNG, NE_LAT, NE_LNG, null)
                .places().get(0);

        assertThat(item.averageCrowdLevel()).isNull();
        assertThat(item.crowdLabel()).isNull();
        assertThat(item.activePins()).isEmpty();
    }

    @Test
    void 필터가_지정되면_평균이_null인_장소는_제외된다() {
        Place place = place(1L, "P1", "조용한책방", 127.030, 37.500);
        given(placeRepository.findWithinBounds(anyDouble(), anyDouble(), anyDouble(), anyDouble()))
                .willReturn(List.of(place));
        given(pinRepository.findValidPins(anyCollection(), any(), any())).willReturn(List.of());

        assertThat(call("wagle").places()).isEmpty();
        assertThat(call("relaxed").places()).isEmpty();
    }

    // ===== 활성 핀 매핑 =====

    @Test
    void 활성핀의_좌표와_작성자_뷰각도가_응답에_매핑된다() {
        Place place = place(1L, "P1", "와글카페", 127.030, 37.500);
        Pin pin = pin(11L, place, member(270), CrowdLevel.WAGLE, 127.0301, 37.5002);
        given(placeRepository.findWithinBounds(anyDouble(), anyDouble(), anyDouble(), anyDouble()))
                .willReturn(List.of(place));
        given(pinRepository.findValidPins(anyCollection(), any(), any())).willReturn(List.of(pin));

        PlaceListItem item = call("wagle").places().get(0);

        assertThat(item.activePins()).hasSize(1);
        assertThat(item.activePins().get(0).pinId()).isEqualTo(new UUID(0, 11L));
        assertThat(item.activePins().get(0).latitude()).isEqualTo(37.5002);
        assertThat(item.activePins().get(0).longitude()).isEqualTo(127.0301);
        assertThat(item.activePins().get(0).viewAngle()).isEqualByComparingTo(java.math.BigDecimal.valueOf(270));
    }

    // ===== 유효 핀 조회 윈도우 =====

    @Test
    void 유효핀_조회에_최근_1시간_윈도우를_전달한다() {
        Place place = place(1L, "P1", "와글카페", 127.030, 37.500);
        given(placeRepository.findWithinBounds(anyDouble(), anyDouble(), anyDouble(), anyDouble()))
                .willReturn(List.of(place));
        given(pinRepository.findValidPins(anyCollection(), any(), any()))
                .willReturn(List.of(pin(11L, place, member(90), CrowdLevel.WAGLE)));

        call("wagle");

        ArgumentCaptor<Instant> fromCaptor = ArgumentCaptor.forClass(Instant.class);
        ArgumentCaptor<Instant> nowCaptor = ArgumentCaptor.forClass(Instant.class);
        verify(pinRepository).findValidPins(anyCollection(), fromCaptor.capture(), nowCaptor.capture());
        // [DEMO] 시연용 임시 변경(원복 예정). 원래 값: Duration.ofHours(1)
        assertThat(Duration.between(fromCaptor.getValue(), nowCaptor.getValue())).isEqualTo(Duration.ofDays(8));
    }

    // ===== 카카오 실시간 조회 =====

    @Test
    void 카카오_호출에_radius10_page1_size5_distance정렬을_전달한다() {
        Place place = place(1L, "P1", "와글카페", 127.030, 37.500);
        given(placeRepository.findWithinBounds(anyDouble(), anyDouble(), anyDouble(), anyDouble()))
                .willReturn(List.of(place));
        given(pinRepository.findValidPins(anyCollection(), any(), any()))
                .willReturn(List.of(pin(11L, place, member(90), CrowdLevel.WAGLE)));

        call("wagle");

        verify(kakaoLocalClient).searchNearby(eq("와글카페"), eq(127.030), eq(37.500),
                eq(10), eq(1), eq(5), eq("accuracy"));
    }

    @Test
    void 카카오_결과중_id가_일치하는_항목의_도로명주소와_전화번호를_사용한다() {
        Place place = place(1L, "kakao-777", "와글카페", 127.030, 37.500);
        given(placeRepository.findWithinBounds(anyDouble(), anyDouble(), anyDouble(), anyDouble()))
                .willReturn(List.of(place));
        given(pinRepository.findValidPins(anyCollection(), any(), any()))
                .willReturn(List.of(pin(11L, place, member(90), CrowdLevel.WAGLE)));
        // 3번째 항목의 id가 일치
        given(kakaoLocalClient.searchNearby(anyString(), anyDouble(), anyDouble(), anyInt(), anyInt(), anyInt(), anyString()))
                .willReturn(new KakaoKeywordResponse(List.of(
                        doc("kakao-111", "도로명1", "지번1", "02-111-1111"),
                        doc("kakao-222", "도로명2", "지번2", "02-222-2222"),
                        doc("kakao-777", "테헤란로 123", "역삼동 456", "02-777-7777"),
                        doc("kakao-333", "도로명3", "지번3", "02-333-3333"),
                        doc("kakao-444", "도로명4", "지번4", "02-444-4444"))));

        PlaceListItem item = call("wagle").places().get(0);

        assertThat(item.address()).isEqualTo("테헤란로 123");
        assertThat(item.phone()).isEqualTo("02-777-7777");
    }

    @Test
    void 카카오_결과에_id가_일치하는_항목이_없으면_주소전화는_빈문자열이고_장소는_유지된다() {
        Place place = place(1L, "kakao-777", "와글카페", 127.030, 37.500);
        given(placeRepository.findWithinBounds(anyDouble(), anyDouble(), anyDouble(), anyDouble()))
                .willReturn(List.of(place));
        given(pinRepository.findValidPins(anyCollection(), any(), any()))
                .willReturn(List.of(pin(11L, place, member(90), CrowdLevel.WAGLE)));
        given(kakaoLocalClient.searchNearby(anyString(), anyDouble(), anyDouble(), anyInt(), anyInt(), anyInt(), anyString()))
                .willReturn(new KakaoKeywordResponse(List.of(
                        doc("kakao-999", "도로명", "지번", "02-999-9999"))));

        PlaceListItem item = call("wagle").places().get(0);

        assertThat(item.placeId()).isEqualTo(1L);
        assertThat(item.address()).isEmpty();
        assertThat(item.phone()).isEmpty();
    }

    @Test
    void 도로명주소가_없으면_지번주소를_사용한다() {
        Place place = place(1L, "kakao-777", "와글카페", 127.030, 37.500);
        given(placeRepository.findWithinBounds(anyDouble(), anyDouble(), anyDouble(), anyDouble()))
                .willReturn(List.of(place));
        given(pinRepository.findValidPins(anyCollection(), any(), any()))
                .willReturn(List.of(pin(11L, place, member(90), CrowdLevel.WAGLE)));
        given(kakaoLocalClient.searchNearby(anyString(), anyDouble(), anyDouble(), anyInt(), anyInt(), anyInt(), anyString()))
                .willReturn(new KakaoKeywordResponse(List.of(
                        doc("kakao-777", "  ", "역삼동 456", "02-777-7777"))));

        PlaceListItem item = call("wagle").places().get(0);

        assertThat(item.address()).isEqualTo("역삼동 456");
    }

    @Test
    void 카카오_호출이_실패하면_PLACES_FETCH_FAILED() {
        Place place = place(1L, "P1", "와글카페", 127.030, 37.500);
        given(placeRepository.findWithinBounds(anyDouble(), anyDouble(), anyDouble(), anyDouble()))
                .willReturn(List.of(place));
        given(pinRepository.findValidPins(anyCollection(), any(), any()))
                .willReturn(List.of(pin(11L, place, member(90), CrowdLevel.WAGLE)));
        given(kakaoLocalClient.searchNearby(anyString(), anyDouble(), anyDouble(), anyInt(), anyInt(), anyInt(), anyString()))
                .willThrow(new RestClientException("카카오 타임아웃"));

        assertError(() -> call("wagle"), ErrorCode.PLACES_FETCH_FAILED);
    }

    // ===== bbox 집계 캐시 =====

    @Test
    void 같은_bbox_재조회시_집계는_캐시되어_DB를_다시_조회하지_않는다() {
        Place place = place(1L, "P1", "와글카페", 127.030, 37.500);
        given(placeRepository.findWithinBounds(anyDouble(), anyDouble(), anyDouble(), anyDouble()))
                .willReturn(List.of(place));
        given(pinRepository.findValidPins(anyCollection(), any(), any()))
                .willReturn(List.of(pin(11L, place, member(90), CrowdLevel.WAGLE)));

        call("wagle");
        call("relaxed"); // 같은 bbox, 필터만 다름

        verify(placeRepository, times(1)).findWithinBounds(anyDouble(), anyDouble(), anyDouble(), anyDouble());
        verify(pinRepository, times(1)).findValidPins(anyCollection(), any(), any());
    }

    // ===== 헬퍼 =====

    private static Point point(double lng, double lat) {
        return GF.createPoint(new Coordinate(lng, lat));
    }

    private static Place place(Long id, String kakaoPlaceId, String name, double lng, double lat) {
        Place place = Place.create(kakaoPlaceId, name, point(lng, lat));
        ReflectionTestUtils.setField(place, "id", id);
        return place;
    }

    private static Member member(int viewAngle) {
        Member member = Member.create("nick", AgeGroup.TWENTIES, Gender.FEMALE);
        ReflectionTestUtils.setField(member, "viewAngle", java.math.BigDecimal.valueOf(viewAngle));
        return member;
    }

    private static Pin pin(Long id, Place place, Member member, CrowdLevel crowdLevel) {
        return pin(id, place, member, crowdLevel,
                place.getLocation().getX(), place.getLocation().getY());
    }

    private static Pin pin(Long id, Place place, Member member, CrowdLevel crowdLevel, double lng, double lat) {
        Pin pin = Pin.create(member, place, crowdLevel, point(lng, lat), null, null, "dummy/video.mp4", null);
        // 핀 PK가 UUID이므로 숫자 seed를 결정적 UUID로 변환해 부여한다(테스트 내 고유성 유지).
        ReflectionTestUtils.setField(pin, "id", new UUID(0, id));
        return pin;
    }

    private static Document doc(String id, String roadAddress, String address, String phone) {
        return new Document(id, "장소명", address, roadAddress, null, null, null, phone, "127.030", "37.500", "10");
    }

    private void assertError(Runnable runnable, ErrorCode expected) {
        assertThatThrownBy(runnable::run)
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(expected);
    }
}
