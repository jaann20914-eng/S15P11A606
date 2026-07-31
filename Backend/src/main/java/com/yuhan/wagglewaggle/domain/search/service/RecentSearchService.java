package com.yuhan.wagglewaggle.domain.search.service;

import com.yuhan.wagglewaggle.domain.place.entity.Place;
import com.yuhan.wagglewaggle.domain.search.dto.RecentSearchResponse;
import com.yuhan.wagglewaggle.domain.search.entity.SearchHistory;
import com.yuhan.wagglewaggle.domain.search.repository.SearchHistoryRepository;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@Slf4j
@RequiredArgsConstructor
public class RecentSearchService {

    private static final int DEFAULT_LIMIT = 20;
    private static final int MAX_LIMIT = 50;

    private final SearchHistoryRepository searchHistoryRepository;

    /**
     * 현재 사용자의 최근 검색기록을 (검색유형, 키워드) 기준으로 중복 제거하여 최신순으로 조회한다.
     * limit 미지정 시 기본값을 사용하며 허용 범위를 벗어나면 INVALID_LIMIT 로 처리한다.
     * 조회 실패 시 부분 응답 없이 RECENT_SEARCHES_FETCH_FAILED 로 처리한다.
     */
    public List<RecentSearchResponse> getRecentSearches(Long memberId, Integer limit) {
        int resolvedLimit = (limit == null) ? DEFAULT_LIMIT : limit;
        if (resolvedLimit < 1 || resolvedLimit > MAX_LIMIT) {
            throw new CustomException(ErrorCode.INVALID_LIMIT);
        }

        try {
            List<SearchHistory> histories =
                    searchHistoryRepository.findRecentDistinctByMember(memberId, resolvedLimit);

            return histories.stream()
                    .map(this::toResponse)
                    .toList();
        } catch (CustomException e) {
            throw e;
        } catch (Exception e) {
            log.error("최근 검색기록 조회 실패 (memberId={})", memberId, e);
            throw new CustomException(ErrorCode.RECENT_SEARCHES_FETCH_FAILED);
        }
    }

    private RecentSearchResponse toResponse(SearchHistory history) {
        Place place = history.getPlace();
        Long placeId = (place != null) ? place.getId() : null;

        return new RecentSearchResponse(
                history.getId(),
                history.getSearchType(),
                history.getKeyword(),
                placeId,
                history.getKakaoPlaceId(),
                history.getCreatedAt()
        );
    }
}
