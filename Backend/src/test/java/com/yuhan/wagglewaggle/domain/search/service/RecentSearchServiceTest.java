package com.yuhan.wagglewaggle.domain.search.service;

import com.yuhan.wagglewaggle.domain.place.entity.Place;
import com.yuhan.wagglewaggle.domain.search.dto.RecentSearchResponse;
import com.yuhan.wagglewaggle.domain.search.entity.SearchHistory;
import com.yuhan.wagglewaggle.domain.search.entity.SearchType;
import com.yuhan.wagglewaggle.domain.search.repository.SearchHistoryRepository;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class RecentSearchServiceTest {

    @Mock private SearchHistoryRepository searchHistoryRepository;

    @InjectMocks private RecentSearchService recentSearchService;

    private static final Long MEMBER_ID = 42L;

    // ===== limit 처리 =====

    @Test
    void limit_미지정시_기본값_20으로_조회한다() {
        given(searchHistoryRepository.findRecentDistinctByMember(eq(MEMBER_ID), anyInt()))
                .willReturn(List.of());

        recentSearchService.getRecentSearches(MEMBER_ID, null);

        verify(searchHistoryRepository).findRecentDistinctByMember(MEMBER_ID, 20);
    }

    @Test
    void limit이_1미만이면_INVALID_LIMIT이고_조회하지_않는다() {
        assertError(() -> recentSearchService.getRecentSearches(MEMBER_ID, 0), ErrorCode.INVALID_LIMIT);

        verify(searchHistoryRepository, never()).findRecentDistinctByMember(any(), anyInt());
    }

    @Test
    void limit이_최대값을_초과하면_INVALID_LIMIT이다() {
        assertError(() -> recentSearchService.getRecentSearches(MEMBER_ID, 51), ErrorCode.INVALID_LIMIT);

        verify(searchHistoryRepository, never()).findRecentDistinctByMember(any(), anyInt());
    }

    @Test
    void limit_경계값_50은_정상적으로_조회한다() {
        given(searchHistoryRepository.findRecentDistinctByMember(eq(MEMBER_ID), anyInt()))
                .willReturn(List.of());

        recentSearchService.getRecentSearches(MEMBER_ID, 50);

        verify(searchHistoryRepository).findRecentDistinctByMember(MEMBER_ID, 50);
    }

    // ===== 결과 매핑 =====

    @Test
    void 기록이_없으면_빈_배열을_반환한다() {
        given(searchHistoryRepository.findRecentDistinctByMember(eq(MEMBER_ID), anyInt()))
                .willReturn(List.of());

        List<RecentSearchResponse> result = recentSearchService.getRecentSearches(MEMBER_ID, 20);

        assertThat(result).isEmpty();
    }

    @Test
    void PLACE_기록은_placeId와_kakaoPlaceId를_채워서_반환한다() {
        Instant createdAt = Instant.parse("2026-07-23T03:00:00Z");
        Place place = mock(Place.class);
        given(place.getId()).willReturn(10L);

        SearchHistory history = mock(SearchHistory.class);
        given(history.getId()).willReturn(1L);
        given(history.getSearchType()).willReturn(SearchType.PLACE);
        given(history.getKeyword()).willReturn("성수 카페");
        given(history.getPlace()).willReturn(place);
        given(history.getKakaoPlaceId()).willReturn("123456");
        given(history.getCreatedAt()).willReturn(createdAt);

        given(searchHistoryRepository.findRecentDistinctByMember(eq(MEMBER_ID), anyInt()))
                .willReturn(List.of(history));

        List<RecentSearchResponse> result = recentSearchService.getRecentSearches(MEMBER_ID, 20);

        assertThat(result).hasSize(1);
        RecentSearchResponse response = result.get(0);
        assertThat(response.searchId()).isEqualTo(1L);
        assertThat(response.type()).isEqualTo(SearchType.PLACE);
        assertThat(response.keyword()).isEqualTo("성수 카페");
        assertThat(response.placeId()).isEqualTo(10L);
        assertThat(response.kakaoPlaceId()).isEqualTo("123456");
        assertThat(response.createdAt()).isEqualTo(createdAt);
    }

    @Test
    void TAG_기록은_placeId와_kakaoPlaceId가_null이다() {
        SearchHistory history = mock(SearchHistory.class);
        given(history.getId()).willReturn(2L);
        given(history.getSearchType()).willReturn(SearchType.TAG);
        given(history.getKeyword()).willReturn("성수 카페");
        given(history.getPlace()).willReturn(null);
        given(history.getKakaoPlaceId()).willReturn(null);
        given(history.getCreatedAt()).willReturn(Instant.parse("2026-07-23T03:00:00Z"));

        given(searchHistoryRepository.findRecentDistinctByMember(eq(MEMBER_ID), anyInt()))
                .willReturn(List.of(history));

        List<RecentSearchResponse> result = recentSearchService.getRecentSearches(MEMBER_ID, 20);

        assertThat(result).hasSize(1);
        RecentSearchResponse response = result.get(0);
        assertThat(response.type()).isEqualTo(SearchType.TAG);
        assertThat(response.placeId()).isNull();
        assertThat(response.kakaoPlaceId()).isNull();
    }

    // ===== 실패 처리 =====

    @Test
    void 조회_중_예외가_발생하면_RECENT_SEARCHES_FETCH_FAILED이다() {
        given(searchHistoryRepository.findRecentDistinctByMember(eq(MEMBER_ID), anyInt()))
                .willThrow(new RuntimeException("DB 오류"));

        assertError(() -> recentSearchService.getRecentSearches(MEMBER_ID, 20),
                ErrorCode.RECENT_SEARCHES_FETCH_FAILED);
    }

    // ===== 헬퍼 =====

    private void assertError(Runnable runnable, ErrorCode expected) {
        assertThatThrownBy(runnable::run)
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(expected);
    }
}
