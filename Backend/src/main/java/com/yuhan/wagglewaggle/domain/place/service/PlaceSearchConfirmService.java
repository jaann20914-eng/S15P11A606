package com.yuhan.wagglewaggle.domain.place.service;

import com.yuhan.wagglewaggle.domain.place.client.KakaoLocalClient;
import com.yuhan.wagglewaggle.domain.place.client.dto.KakaoKeywordResponse;
import com.yuhan.wagglewaggle.domain.place.client.dto.KakaoKeywordResponse.Document;
import com.yuhan.wagglewaggle.domain.place.dto.PlaceDetailResponse;
import com.yuhan.wagglewaggle.domain.place.dto.PlaceInfo;
import com.yuhan.wagglewaggle.domain.place.entity.Place;
import com.yuhan.wagglewaggle.domain.place.repository.PlaceRepository;
import com.yuhan.wagglewaggle.domain.search.entity.SearchHistory;
import com.yuhan.wagglewaggle.domain.search.entity.SearchType;
import com.yuhan.wagglewaggle.domain.search.repository.SearchHistoryRepository;
import com.yuhan.wagglewaggle.domain.user.entity.Member;
import com.yuhan.wagglewaggle.domain.user.repository.MemberRepository;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientException;

import java.util.List;

@Service
@Slf4j
@RequiredArgsConstructor
public class PlaceSearchConfirmService {

    private static final int KAKAO_PAGE = 1;
    private static final int KAKAO_SIZE = 1;
    private static final String KAKAO_SORT = "accuracy";

    private final PlaceRepository placeRepository;
    private final PlaceDetailService placeDetailService;
    private final KakaoLocalClient kakaoLocalClient;
    private final MemberRepository memberRepository;
    private final SearchHistoryRepository searchHistoryRepository;

    /**
     * 추천 검색어에서 선택한 장소를 확정한다.
     * 우리 DB에 있으면 장소 상세({@link PlaceDetailService})와 동일한 결과를 반환하고,
     * 없으면 카카오에서 주소·연락처만 채운 장소를 반환하며 핀·혼잡 통계는 빈 배열이다(장소를 저장하지 않는다).
     * 성공 시 검색 이력을 남기며, 이력 저장 실패는 응답을 막지 않는다(best-effort).
     */
    public PlaceDetailResponse confirmPlaceSearch(String kakaoPlaceId, String placeName, Long memberId) {
        String validKakaoPlaceId = requireNonBlank(kakaoPlaceId);
        String validPlaceName = requireNonBlank(placeName);

        Place place = placeRepository.findByKakaoPlaceId(validKakaoPlaceId).orElse(null);

        PlaceDetailResponse response = (place != null)
                ? placeDetailService.getPlaceDetail(place, memberId)
                : loadUnregisteredPlace(validKakaoPlaceId, validPlaceName);

        saveSearchHistory(memberId, place, validPlaceName);
        return response;
    }

    private String requireNonBlank(String value) {
        if (value == null || value.isBlank()) {
            throw new CustomException(ErrorCode.INVALID_PLACE_SEARCH_QUERY);
        }
        return value.trim();
    }

    /**
     * 우리 DB에 없는 장소를 카카오 키워드 검색(좌표 없이 accuracy top-1)으로 조회한다.
     * kakao_place_id가 일치하는 문서에서 주소·연락처만 채우고 핀·혼잡 통계는 빈 배열로 반환하며,
     * 일치하는 문서가 없으면 PLACE_NOT_FOUND 로 처리한다.
     */
    private PlaceDetailResponse loadUnregisteredPlace(String kakaoPlaceId, String placeName) {
        KakaoKeywordResponse kakaoResponse = callKakaoForKeyword(placeName);
        Document matched = PlaceDetailService.findMatchingDocument(kakaoResponse, kakaoPlaceId);
        if (matched == null) {
            throw new CustomException(ErrorCode.PLACE_NOT_FOUND);
        }

        String address = PlaceDetailService.resolveAddress(matched);
        String phone = (matched.phone() != null && !matched.phone().isBlank()) ? matched.phone() : "";
        PlaceInfo placeInfo = new PlaceInfo(null, matched.placeName(), address, phone);

        return new PlaceDetailResponse(placeInfo, List.of(), List.of());
    }

    private KakaoKeywordResponse callKakaoForKeyword(String keyword) {
        try {
            return kakaoLocalClient.searchKeywordOnly(keyword, KAKAO_PAGE, KAKAO_SIZE, KAKAO_SORT);
        } catch (HttpStatusCodeException e) {
            log.error("카카오 장소 확정 검색 오류 응답: {}", e.getMessage(), e);
            throw new CustomException(ErrorCode.EXTERNAL_PLACE_API_ERROR);
        } catch (ResourceAccessException e) {
            log.error("카카오 장소 확정 검색 연결 실패/타임아웃: {}", e.getMessage(), e);
            throw new CustomException(ErrorCode.EXTERNAL_PLACE_API_UNAVAILABLE);
        } catch (RestClientException e) {
            log.error("카카오 장소 확정 검색 실패: {}", e.getMessage(), e);
            throw new CustomException(ErrorCode.EXTERNAL_PLACE_API_ERROR);
        }
    }

    /**
     * 장소 검색 기록을 저장한다. search_type=PLACE, keyword=장소명.
     * 우리 DB에 있는 장소면 place 참조를 함께 저장하고, 없으면 place=null 이다.
     * 매 검색마다 새 기록을 남기며, 저장 실패가 응답을 막지 않도록 best-effort 로 처리한다.
     */
    private void saveSearchHistory(Long memberId, Place place, String keyword) {
        try {
            Member member = memberRepository.getReferenceById(memberId);
            searchHistoryRepository.save(SearchHistory.create(member, place, SearchType.PLACE, keyword));
        } catch (Exception e) {
            log.warn("장소 검색 기록 저장 실패 (memberId={}, keyword={})", memberId, keyword, e);
        }
    }
}
