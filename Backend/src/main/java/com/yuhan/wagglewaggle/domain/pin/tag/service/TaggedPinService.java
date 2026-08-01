package com.yuhan.wagglewaggle.domain.pin.tag.service;

import com.yuhan.wagglewaggle.domain.pin.dto.TaggedPinsResponse;
import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import com.yuhan.wagglewaggle.domain.pin.repository.PinRepository;
import com.yuhan.wagglewaggle.domain.pin.service.PinCardAssembler;
import com.yuhan.wagglewaggle.domain.place.dto.PinCard;
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

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class TaggedPinService {

    private static final int MAX_TAG_LENGTH = 30;

    private final PinRepository pinRepository;
    private final MemberRepository memberRepository;
    private final SearchHistoryRepository searchHistoryRepository;
    private final PinCardAssembler pinCardAssembler;
    private final TagQueryNormalizer tagQueryNormalizer;

    /**
     * 요청한 태그가 정확히 일치하는 활성 핀 목록을 지도 영역 기준으로 조회한다(태그 검색 확정).
     * 태그·지도 경계 검증 후 핀을 조회하며, 조회 실패 시 부분 응답 없이 TAGGED_PINS_FETCH_FAILED 로 처리한다.
     * 검색 성공 여부와 무관하게 검색 결과에 해당하므로 최근 검색기록으로 저장한다(저장 실패는 응답을 막지 않음).
     */
    public TaggedPinsResponse searchPinsByTag(
            Long memberId, String tag,
            double southWestLatitude, double southWestLongitude,
            double northEastLatitude, double northEastLongitude) {

        String normalizedTag = tagQueryNormalizer.normalizeKeyword(
                tag, MAX_TAG_LENGTH, false, ErrorCode.INVALID_TAG_NAME);
        tagQueryNormalizer.validateBounds(
                southWestLatitude, southWestLongitude, northEastLatitude, northEastLongitude,
                ErrorCode.INVALID_MAP_RANGE);

        List<PinCard> pins;
        try {
            pins = loadTaggedPinCards(normalizedTag, memberId,
                    southWestLatitude, southWestLongitude, northEastLatitude, northEastLongitude);
        } catch (CustomException e) {
            throw e;
        } catch (Exception e) {
            log.error("태그 핀 목록 조회 실패 (tag={})", normalizedTag, e);
            throw new CustomException(ErrorCode.TAGGED_PINS_FETCH_FAILED);
        }

        saveSearchHistory(memberId, normalizedTag);
        return new TaggedPinsResponse(pins);
    }

    /**
     * 태그·지도 영역에 맞는 활성 핀을 조회하고 핀 카드로 조립한다.
     * 네이티브 쿼리 결과의 member는 LAZY이므로 작성자를 별도 배치 조회한 뒤,
     * 공통 조립기({@link PinCardAssembler})에 작성자 조회 함수로 전달한다.
     */
    private List<PinCard> loadTaggedPinCards(
            String tag, Long memberId,
            double southWestLatitude, double southWestLongitude,
            double northEastLatitude, double northEastLongitude) {

        Instant now = Instant.now();
        List<Pin> pins = pinRepository.findActivePinsByTagWithinBounds(
                tag, now,
                southWestLongitude, southWestLatitude,
                northEastLongitude, northEastLatitude);
        if (pins.isEmpty()) {
            return List.of();
        }

        List<Long> authorIds = pins.stream().map(pin -> pin.getMember().getId()).distinct().toList();
        Map<Long, Member> authorsById = memberRepository.findAllById(authorIds).stream()
                .collect(Collectors.toMap(Member::getId, member -> member));

        return pinCardAssembler.assemble(pins, memberId,
                pin -> authorsById.get(pin.getMember().getId()));
    }

    /**
     * 태그 검색 기록을 저장한다. search_type=TAG, place=null, kakao_place_id=null, keyword=정규화된 태그.
     * 매 검색마다 새 기록을 남기며(중복 제거 없음), 저장 실패가 핀 목록 응답을 막지 않도록 best-effort로 처리한다.
     */
    private void saveSearchHistory(Long memberId, String keyword) {
        try {
            Member member = memberRepository.getReferenceById(memberId);
            searchHistoryRepository.save(SearchHistory.create(member, null, null, SearchType.TAG, keyword));
        } catch (Exception e) {
            log.warn("태그 검색 기록 저장 실패 (memberId={}, keyword={})", memberId, keyword, e);
        }
    }
}
