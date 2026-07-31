package com.yuhan.wagglewaggle.domain.place.service;

import com.yuhan.wagglewaggle.domain.place.client.KakaoLocalClient;
import com.yuhan.wagglewaggle.domain.place.client.dto.KakaoKeywordResponse;
import com.yuhan.wagglewaggle.domain.place.client.dto.KakaoKeywordResponse.Document;
import com.yuhan.wagglewaggle.domain.place.dto.PinCard;
import com.yuhan.wagglewaggle.domain.place.dto.PlaceDetailResponse;
import com.yuhan.wagglewaggle.domain.place.dto.PlaceInfo;
import com.yuhan.wagglewaggle.domain.place.dto.WeeklyCrowdStat;
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
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PlaceSearchConfirmServiceTest {

    @Mock private PlaceRepository placeRepository;
    @Mock private PlaceDetailService placeDetailService;
    @Mock private KakaoLocalClient kakaoLocalClient;
    @Mock private MemberRepository memberRepository;
    @Mock private SearchHistoryRepository searchHistoryRepository;

    private PlaceSearchConfirmService placeSearchConfirmService;

    private static final Long MEMBER_ID = 42L;
    private static final String KAKAO_PLACE_ID = "1234567890";
    private static final String PLACE_NAME = "카페 A";

    private static final PinCard SAMPLE_CARD = new PinCard(
            UUID.fromString("00000000-0000-0000-0000-000000000001"),
            "준호", 92, Instant.parse("2026-07-31T05:00:00Z"),
            "메모", "pins/1/thumb.jpg", false, List.of("카페", "감성"));

    @BeforeEach
    void setUp() {
        placeSearchConfirmService = new PlaceSearchConfirmService(
                placeRepository, placeDetailService, kakaoLocalClient,
                memberRepository, searchHistoryRepository);
    }

    // ===== case 1: DB에 존재하는 장소 =====

    @Test
    void DB에_있는_장소면_상세조회_결과를_그대로_반환하고_place참조로_검색기록을_저장한다() {
        Place place = mock(Place.class);
        PlaceDetailResponse detail = new PlaceDetailResponse(
                new PlaceInfo(1L, PLACE_NAME, "서울 강남구...", "02-123-4567"),
                List.of(SAMPLE_CARD),
                List.of(new WeeklyCrowdStat("MON", 2.4)));

        given(placeRepository.findByKakaoPlaceId(KAKAO_PLACE_ID)).willReturn(Optional.of(place));
        given(placeDetailService.getPlaceDetail(place, MEMBER_ID)).willReturn(detail);
        given(memberRepository.getReferenceById(MEMBER_ID)).willReturn(mock(Member.class));

        PlaceDetailResponse response = placeSearchConfirmService.confirmPlaceSearch(
                KAKAO_PLACE_ID, PLACE_NAME, MEMBER_ID);

        assertThat(response).isSameAs(detail);
        // 미존재 장소용 카카오 조회는 하지 않는다.
        verify(kakaoLocalClient, never()).searchKeywordOnly(anyString(), anyInt(), anyInt(), anyString());

        // 검색기록: search_type=PLACE, keyword=장소명, place=조회된 엔티티.
        ArgumentCaptor<SearchHistory> captor = ArgumentCaptor.forClass(SearchHistory.class);
        verify(searchHistoryRepository).save(captor.capture());
        SearchHistory saved = captor.getValue();
        assertThat(saved.getSearchType()).isEqualTo(SearchType.PLACE);
        assertThat(saved.getKeyword()).isEqualTo(PLACE_NAME);
        assertThat(saved.getPlace()).isSameAs(place);
        assertThat(saved.getKakaoPlaceId()).isEqualTo(KAKAO_PLACE_ID);
    }

    // ===== case 2: DB 미존재 + 카카오 매칭 =====

    @Test
    void DB에_없지만_카카오에_매칭되면_place만_채우고_핀과_통계는_빈배열이며_place는_null로_저장한다() {
        Document matched = new Document(
                KAKAO_PLACE_ID, "카카오 카페 A", "서울 강남구 지번",
                "서울 강남구 도로명 123", "02-987-6543", "127.02", "37.50", null);

        given(placeRepository.findByKakaoPlaceId(KAKAO_PLACE_ID)).willReturn(Optional.empty());
        given(kakaoLocalClient.searchKeywordOnly(PLACE_NAME, 1, 1, "accuracy"))
                .willReturn(new KakaoKeywordResponse(List.of(matched)));
        given(memberRepository.getReferenceById(MEMBER_ID)).willReturn(mock(Member.class));

        PlaceDetailResponse response = placeSearchConfirmService.confirmPlaceSearch(
                KAKAO_PLACE_ID, PLACE_NAME, MEMBER_ID);

        assertThat(response.place().placeId()).isNull();
        assertThat(response.place().name()).isEqualTo("카카오 카페 A");
        assertThat(response.place().address()).isEqualTo("서울 강남구 도로명 123"); // 도로명 우선
        assertThat(response.place().phone()).isEqualTo("02-987-6543");
        assertThat(response.pins()).isEmpty();
        assertThat(response.weeklyCrowdStats()).isEmpty();
        // 미존재 장소는 상세조회 위임을 하지 않는다.
        verify(placeDetailService, never()).getPlaceDetail(any(Place.class), any());

        ArgumentCaptor<SearchHistory> captor = ArgumentCaptor.forClass(SearchHistory.class);
        verify(searchHistoryRepository).save(captor.capture());
        assertThat(captor.getValue().getSearchType()).isEqualTo(SearchType.PLACE);
        assertThat(captor.getValue().getPlace()).isNull();
        // place_id는 null이어도 kakao_place_id는 저장된다.
        assertThat(captor.getValue().getKakaoPlaceId()).isEqualTo(KAKAO_PLACE_ID);
    }

    // ===== case 2: DB 미존재 + 카카오 미매칭/빈 결과 =====

    @Test
    void DB에_없고_카카오_top1의_id가_다르면_PLACE_NOT_FOUND이고_검색기록을_저장하지_않는다() {
        Document other = new Document(
                "9999999999", "다른 카페", "지번", "도로명", "02-000-0000", "127.02", "37.50", null);

        given(placeRepository.findByKakaoPlaceId(KAKAO_PLACE_ID)).willReturn(Optional.empty());
        given(kakaoLocalClient.searchKeywordOnly(PLACE_NAME, 1, 1, "accuracy"))
                .willReturn(new KakaoKeywordResponse(List.of(other)));

        assertError(() -> placeSearchConfirmService.confirmPlaceSearch(
                KAKAO_PLACE_ID, PLACE_NAME, MEMBER_ID), ErrorCode.PLACE_NOT_FOUND);

        verify(searchHistoryRepository, never()).save(any());
    }

    @Test
    void DB에_없고_카카오_결과가_비어있으면_PLACE_NOT_FOUND이다() {
        given(placeRepository.findByKakaoPlaceId(KAKAO_PLACE_ID)).willReturn(Optional.empty());
        given(kakaoLocalClient.searchKeywordOnly(PLACE_NAME, 1, 1, "accuracy"))
                .willReturn(new KakaoKeywordResponse(List.of()));

        assertError(() -> placeSearchConfirmService.confirmPlaceSearch(
                KAKAO_PLACE_ID, PLACE_NAME, MEMBER_ID), ErrorCode.PLACE_NOT_FOUND);

        verify(searchHistoryRepository, never()).save(any());
    }

    // ===== 요청 검증 =====

    @Test
    void placeName이_공백이면_INVALID_PLACE_SEARCH_QUERY이고_아무것도_조회하지_않는다() {
        assertError(() -> placeSearchConfirmService.confirmPlaceSearch(
                KAKAO_PLACE_ID, "   ", MEMBER_ID), ErrorCode.INVALID_PLACE_SEARCH_QUERY);

        verify(placeRepository, never()).findByKakaoPlaceId(any());
        verify(kakaoLocalClient, never()).searchKeywordOnly(anyString(), anyInt(), anyInt(), anyString());
        verify(searchHistoryRepository, never()).save(any());
    }

    @Test
    void kakaoPlaceId가_공백이면_INVALID_PLACE_SEARCH_QUERY이다() {
        assertError(() -> placeSearchConfirmService.confirmPlaceSearch(
                "  ", PLACE_NAME, MEMBER_ID), ErrorCode.INVALID_PLACE_SEARCH_QUERY);

        verify(placeRepository, never()).findByKakaoPlaceId(any());
    }

    // ===== best-effort 검색기록 =====

    @Test
    void 검색기록_저장이_실패해도_확정_응답은_정상_반환한다() {
        Place place = mock(Place.class);
        PlaceDetailResponse detail = new PlaceDetailResponse(
                new PlaceInfo(1L, PLACE_NAME, "주소", "전화"), List.of(), List.of());

        given(placeRepository.findByKakaoPlaceId(KAKAO_PLACE_ID)).willReturn(Optional.of(place));
        given(placeDetailService.getPlaceDetail(place, MEMBER_ID)).willReturn(detail);
        given(memberRepository.getReferenceById(MEMBER_ID)).willReturn(mock(Member.class));
        given(searchHistoryRepository.save(any())).willThrow(new RuntimeException("저장 실패"));

        PlaceDetailResponse response = placeSearchConfirmService.confirmPlaceSearch(
                KAKAO_PLACE_ID, PLACE_NAME, MEMBER_ID);

        assertThat(response).isSameAs(detail);
    }

    // ===== 헬퍼 =====

    private void assertError(Runnable runnable, ErrorCode expected) {
        assertThatThrownBy(runnable::run)
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(expected);
    }
}
