package com.yuhan.wagglewaggle.domain.place.service;

import com.yuhan.wagglewaggle.domain.pin.entity.CrowdLevel;
import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import com.yuhan.wagglewaggle.domain.pin.entity.PinTag;
import com.yuhan.wagglewaggle.domain.pin.repository.PinRepository;
import com.yuhan.wagglewaggle.domain.pin.repository.PinTagRepository;
import com.yuhan.wagglewaggle.domain.pin.repository.PinUnlockRepository;
import com.yuhan.wagglewaggle.domain.pin.repository.WeeklyCrowdStatRow;
import com.yuhan.wagglewaggle.domain.place.client.KakaoLocalClient;
import com.yuhan.wagglewaggle.domain.place.client.dto.KakaoKeywordResponse;
import com.yuhan.wagglewaggle.domain.place.client.dto.KakaoKeywordResponse.Document;
import com.yuhan.wagglewaggle.domain.place.dto.PinCard;
import com.yuhan.wagglewaggle.domain.place.dto.PlaceDetailResponse;
import com.yuhan.wagglewaggle.domain.place.dto.WeeklyCrowdStat;
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

import java.time.Instant;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PlaceDetailServiceTest {

    @Mock private PlaceRepository placeRepository;
    @Mock private PinRepository pinRepository;
    @Mock private PinTagRepository pinTagRepository;
    @Mock private PinUnlockRepository pinUnlockRepository;
    @Mock private KakaoLocalClient kakaoLocalClient;

    @InjectMocks private PlaceDetailService placeDetailService;

    private static final GeometryFactory GF = new GeometryFactory(new PrecisionModel(), 4326);
    private static final Long MEMBER_ID = 1000L;

    @BeforeEach
    void setUp() {
        // 기본 스텁: 각 조회는 비어 있고 카카오는 매칭 결과 없음(주소/전화 "").
        // 개별 테스트에서 필요한 부분만 재정의한다.
        given(pinRepository.findActivePinsByPlaceId(anyLong(), any(), any())).willReturn(List.of());
        given(pinRepository.findWeeklyCrowdStats(anyLong(), any(), any(), anyBoolean())).willReturn(List.of());
        given(pinTagRepository.findByPin_IdIn(anyCollection())).willReturn(List.of());
        given(pinUnlockRepository.findUnlockedPinIds(anyLong(), anyCollection())).willReturn(List.of());
        given(kakaoLocalClient.searchNearby(anyString(), anyDouble(), anyDouble(), anyInt(), anyInt(), anyInt(), anyString()))
                .willReturn(new KakaoKeywordResponse(List.of()));
    }

    // ===== ID 검증 =====

    @Test
    void ID가_숫자가_아니면_INVALID_PLACE_ID() {
        assertError(() -> placeDetailService.getPlaceDetail("abc", MEMBER_ID), ErrorCode.INVALID_PLACE_ID);
        verify(placeRepository, never()).findById(anyLong());
    }

    @Test
    void ID가_0이하이면_INVALID_PLACE_ID() {
        assertError(() -> placeDetailService.getPlaceDetail("0", MEMBER_ID), ErrorCode.INVALID_PLACE_ID);
        assertError(() -> placeDetailService.getPlaceDetail("-5", MEMBER_ID), ErrorCode.INVALID_PLACE_ID);
    }

    @Test
    void 존재하지_않는_장소면_PLACE_NOT_FOUND() {
        given(placeRepository.findById(9L)).willReturn(Optional.empty());

        assertError(() -> placeDetailService.getPlaceDetail("9", MEMBER_ID), ErrorCode.PLACE_NOT_FOUND);
    }

    // ===== 정상 조립 =====

    @Test
    void 정상_조회시_장소_활성핀_통계를_조립한다() {
        Place place = place(1L, "kakao-1", "와글카페", 127.030, 37.500);
        given(placeRepository.findById(1L)).willReturn(Optional.of(place));

        Pin newer = pin(11L, place, member("준호", 92), CrowdLevel.WAGLE_WAGLE,
                "창가 자리 있어요", "pins/11/thumb.jpg", Instant.parse("2026-07-31T05:00:00Z"));
        Pin older = pin(12L, place, member("지민", 150), CrowdLevel.WAGLE,
                "디저트 맛집", "pins/12/thumb.jpg", Instant.parse("2026-07-31T04:50:00Z"));
        given(pinRepository.findActivePinsByPlaceId(eq(1L), any(), any()))
                .willReturn(List.of(newer, older)); // 쿼리가 createdAt DESC로 정렬한 결과를 가정

        given(pinTagRepository.findByPin_IdIn(anyCollection()))
                .willReturn(List.of(tag(newer, "카페"), tag(newer, "감성"))); // older는 태그 없음
        given(pinUnlockRepository.findUnlockedPinIds(eq(MEMBER_ID), anyCollection()))
                .willReturn(List.of(11L)); // newer만 열람

        given(pinRepository.findWeeklyCrowdStats(eq(1L), any(), any(), anyBoolean()))
                .willReturn(List.of(row(1, 3.0), row(3, 2.0))); // MON, WED

        given(kakaoLocalClient.searchNearby(anyString(), anyDouble(), anyDouble(), anyInt(), anyInt(), anyInt(), anyString()))
                .willReturn(new KakaoKeywordResponse(List.of(
                        doc("kakao-1", "테헤란로 123", "역삼동 456", "02-123-4567"))));

        PlaceDetailResponse response = placeDetailService.getPlaceDetail("1", MEMBER_ID);

        // 장소
        assertThat(response.place().placeId()).isEqualTo(1L);
        assertThat(response.place().name()).isEqualTo("와글카페");
        assertThat(response.place().address()).isEqualTo("테헤란로 123");
        assertThat(response.place().phone()).isEqualTo("02-123-4567");

        // 핀 카드 (반환 순서 유지)
        assertThat(response.pins()).extracting(PinCard::pinId).containsExactly(11L, 12L);
        PinCard first = response.pins().get(0);
        assertThat(first.nickname()).isEqualTo("준호");
        assertThat(first.viewAngle()).isEqualTo(92);
        assertThat(first.memo()).isEqualTo("창가 자리 있어요");
        assertThat(first.thumbnailKey()).isEqualTo("pins/11/thumb.jpg");
        assertThat(first.isUnlocked()).isTrue();
        assertThat(first.tags()).containsExactly("카페", "감성");

        PinCard second = response.pins().get(1);
        assertThat(second.isUnlocked()).isFalse();
        assertThat(second.tags()).isEmpty();

        // 통계 (MON~SUN 7개, 없는 요일 null)
        assertThat(response.weeklyCrowdStats()).extracting(WeeklyCrowdStat::dayOfWeek)
                .containsExactly("MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN");
        assertThat(response.weeklyCrowdStats()).extracting(WeeklyCrowdStat::averageCrowdLevel)
                .containsExactly(3.0, null, 2.0, null, null, null, null);
    }

    @Test
    void 태그와_열람은_핀ID로_각각_한번씩_배치조회한다() {
        Place place = place(1L, "kakao-1", "와글카페", 127.030, 37.500);
        given(placeRepository.findById(1L)).willReturn(Optional.of(place));
        given(pinRepository.findActivePinsByPlaceId(eq(1L), any(), any()))
                .willReturn(List.of(pin(11L, place, member("준호", 92), CrowdLevel.WAGLE,
                        "메모", "pins/11/thumb.jpg", Instant.parse("2026-07-31T05:00:00Z"))));

        placeDetailService.getPlaceDetail("1", MEMBER_ID);

        verify(pinTagRepository, times(1)).findByPin_IdIn(anyCollection());
        verify(pinUnlockRepository, times(1)).findUnlockedPinIds(eq(MEMBER_ID), anyCollection());
    }

    // ===== 활성 핀 없음 =====

    @Test
    void 활성_핀이_없으면_pins는_빈_배열이고_태그_열람은_조회하지_않는다() {
        Place place = place(1L, "kakao-1", "와글카페", 127.030, 37.500);
        given(placeRepository.findById(1L)).willReturn(Optional.of(place));
        given(pinRepository.findActivePinsByPlaceId(eq(1L), any(), any())).willReturn(List.of());

        PlaceDetailResponse response = placeDetailService.getPlaceDetail("1", MEMBER_ID);

        assertThat(response.pins()).isEmpty();
        verify(pinTagRepository, never()).findByPin_IdIn(anyCollection());
        verify(pinUnlockRepository, never()).findUnlockedPinIds(anyLong(), anyCollection());
    }

    // ===== 통계 =====

    @Test
    void 전체_요일_통계가_없으면_weeklyCrowdStats는_빈_배열이다() {
        Place place = place(1L, "kakao-1", "와글카페", 127.030, 37.500);
        given(placeRepository.findById(1L)).willReturn(Optional.of(place));
        given(pinRepository.findWeeklyCrowdStats(eq(1L), any(), any(), anyBoolean())).willReturn(List.of());

        PlaceDetailResponse response = placeDetailService.getPlaceDetail("1", MEMBER_ID);

        assertThat(response.weeklyCrowdStats()).isEmpty();
    }

    @Test
    void 평균_혼잡도는_소수점_첫째_자리로_반올림된다() {
        Place place = place(1L, "kakao-1", "와글카페", 127.030, 37.500);
        given(placeRepository.findById(1L)).willReturn(Optional.of(place));
        // 2.35 → 2.4, 3.666... → 3.7
        given(pinRepository.findWeeklyCrowdStats(eq(1L), any(), any(), anyBoolean()))
                .willReturn(List.of(row(2, 2.35), row(5, 3.6666666)));

        PlaceDetailResponse response = placeDetailService.getPlaceDetail("1", MEMBER_ID);

        assertThat(averageOf(response, "TUE")).isEqualTo(2.4);
        assertThat(averageOf(response, "FRI")).isEqualTo(3.7);
    }

    @Test
    void 통계_조회창은_요청시각_기준_앞뒤_30분씩_1시간이다() {
        Place place = place(1L, "kakao-1", "와글카페", 127.030, 37.500);
        given(placeRepository.findById(1L)).willReturn(Optional.of(place));

        placeDetailService.getPlaceDetail("1", MEMBER_ID);

        ArgumentCaptor<LocalTime> startCaptor = ArgumentCaptor.forClass(LocalTime.class);
        ArgumentCaptor<LocalTime> endCaptor = ArgumentCaptor.forClass(LocalTime.class);
        verify(pinRepository).findWeeklyCrowdStats(eq(1L), startCaptor.capture(), endCaptor.capture(), anyBoolean());
        // 자정을 넘겨도(LocalTime wrap) 항상 start + 1시간 == end 여야 한다.
        assertThat(startCaptor.getValue().plusHours(1)).isEqualTo(endCaptor.getValue());
    }

    // ===== 실패 시 부분 응답 금지 =====

    @Test
    void 카카오_조회가_실패하면_PLACE_DETAIL_FETCH_FAILED() {
        Place place = place(1L, "kakao-1", "와글카페", 127.030, 37.500);
        given(placeRepository.findById(1L)).willReturn(Optional.of(place));
        given(kakaoLocalClient.searchNearby(anyString(), anyDouble(), anyDouble(), anyInt(), anyInt(), anyInt(), anyString()))
                .willThrow(new RestClientException("카카오 타임아웃"));

        assertError(() -> placeDetailService.getPlaceDetail("1", MEMBER_ID), ErrorCode.PLACE_DETAIL_FETCH_FAILED);
    }

    @Test
    void 통계_조회가_실패하면_PLACE_DETAIL_FETCH_FAILED() {
        Place place = place(1L, "kakao-1", "와글카페", 127.030, 37.500);
        given(placeRepository.findById(1L)).willReturn(Optional.of(place));
        given(pinRepository.findWeeklyCrowdStats(eq(1L), any(), any(), anyBoolean()))
                .willThrow(new RuntimeException("DB 오류"));

        assertError(() -> placeDetailService.getPlaceDetail("1", MEMBER_ID), ErrorCode.PLACE_DETAIL_FETCH_FAILED);
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

    private static Member member(String nickname, int viewAngle) {
        Member member = Member.create(nickname, AgeGroup.TWENTIES, Gender.FEMALE);
        ReflectionTestUtils.setField(member, "viewAngle", viewAngle);
        return member;
    }

    private static Pin pin(Long id, Place place, Member member, CrowdLevel crowdLevel,
                           String memo, String thumbnailKey, Instant createdAt) {
        Pin pin = Pin.create(member, place, crowdLevel,
                point(place.getLocation().getX(), place.getLocation().getY()),
                null, memo, "dummy/video.mp4", null);
        ReflectionTestUtils.setField(pin, "id", id);
        ReflectionTestUtils.setField(pin, "thumbnailKey", thumbnailKey);
        ReflectionTestUtils.setField(pin, "createdAt", createdAt);
        return pin;
    }

    private static PinTag tag(Pin pin, String tag) {
        return PinTag.create(pin, tag);
    }

    private static Document doc(String id, String roadAddress, String address, String phone) {
        return new Document(id, "장소명", address, roadAddress, phone, "127.030", "37.500", "10");
    }

    /** 요일별 혼잡 통계 native 프로젝션(WeeklyCrowdStatRow)의 테스트용 구현. dow: 0=일 ... 6=토. */
    private static WeeklyCrowdStatRow row(int dayOfWeek, double averageWeight) {
        return new WeeklyCrowdStatRow() {
            @Override
            public Integer getDayOfWeek() {
                return dayOfWeek;
            }

            @Override
            public Double getAverageWeight() {
                return averageWeight;
            }
        };
    }

    private static Double averageOf(PlaceDetailResponse response, String dayOfWeek) {
        return response.weeklyCrowdStats().stream()
                .filter(stat -> stat.dayOfWeek().equals(dayOfWeek))
                .map(WeeklyCrowdStat::averageCrowdLevel)
                .findFirst()
                .orElseThrow();
    }

    private void assertError(Runnable runnable, ErrorCode expected) {
        assertThatThrownBy(runnable::run)
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(expected);
    }
}
