package com.yuhan.wagglewaggle.domain.pin.tag.service;

import com.yuhan.wagglewaggle.domain.pin.dto.TaggedPlaceItem;
import com.yuhan.wagglewaggle.domain.pin.dto.TaggedPlacesResponse;
import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import com.yuhan.wagglewaggle.domain.pin.repository.PinRepository;
import com.yuhan.wagglewaggle.domain.place.dto.ActivePinResponse;
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

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class TaggedPinService {

    private static final int MAX_TAG_LENGTH = 30;

    private final PinRepository pinRepository;
    private final PlaceRepository placeRepository;
    private final MemberRepository memberRepository;
    private final SearchHistoryRepository searchHistoryRepository;
    private final TagQueryNormalizer tagQueryNormalizer;

    /**
     * 요청한 태그가 정확히 일치하는 활성 핀을 지도 영역 기준으로 조회하고 장소별로 묶어 반환한다(태그 검색 확정).
     * 태그·지도 경계 검증 후 핀을 조회하며, 조회 실패 시 부분 응답 없이 TAGGED_PINS_FETCH_FAILED 로 처리한다.
     * 검색 성공 여부와 무관하게 검색 결과에 해당하므로 최근 검색기록으로 저장한다(저장 실패는 응답을 막지 않음).
     */
    public TaggedPlacesResponse searchPinsByTag(
            Long memberId, String tag,
            double southWestLatitude, double southWestLongitude,
            double northEastLatitude, double northEastLongitude) {

        String normalizedTag = tagQueryNormalizer.normalizeKeyword(
                tag, MAX_TAG_LENGTH, false, ErrorCode.INVALID_TAG_NAME);
        tagQueryNormalizer.validateBounds(
                southWestLatitude, southWestLongitude, northEastLatitude, northEastLongitude,
                ErrorCode.INVALID_MAP_RANGE);

        List<TaggedPlaceItem> places;
        try {
            places = loadTaggedPlaces(normalizedTag,
                    southWestLatitude, southWestLongitude, northEastLatitude, northEastLongitude);
        } catch (CustomException e) {
            throw e;
        } catch (Exception e) {
            log.error("태그 핀 목록 조회 실패 (tag={})", normalizedTag, e);
            throw new CustomException(ErrorCode.TAGGED_PINS_FETCH_FAILED);
        }

        saveSearchHistory(memberId, normalizedTag);
        return new TaggedPlacesResponse(normalizedTag, places);
    }

    /**
     * 태그·지도 영역에 맞는 활성 핀을 조회해 장소별로 묶는다.
     * 네이티브 쿼리 결과의 member·place는 LAZY이므로 각각 배치 조회로 N+1을 방지하고,
     * 장소 목록은 지도 중심에 가까운 순으로 정렬한다(개수 제한 없음).
     */
    private List<TaggedPlaceItem> loadTaggedPlaces(
            String tag,
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

        // 작성자 뷰 각도(viewAngle)를 위해 작성자를 배치 조회한다(LAZY member N+1 방지).
        List<Long> authorIds = pins.stream().map(pin -> pin.getMember().getId()).distinct().toList();
        Map<Long, Member> authorsById = memberRepository.findAllById(authorIds).stream()
                .collect(Collectors.toMap(Member::getId, member -> member));

        // 장소 정보(이름·주소·전화·좌표)를 위해 장소를 배치 조회한다(LAZY place N+1 방지).
        List<Long> placeIds = pins.stream().map(pin -> pin.getPlace().getId()).distinct().toList();
        Map<Long, Place> placesById = placeRepository.findAllById(placeIds).stream()
                .collect(Collectors.toMap(Place::getId, place -> place));

        Map<Long, List<Pin>> pinsByPlaceId = pins.stream()
                .collect(Collectors.groupingBy(pin -> pin.getPlace().getId()));

        double centerLatitude = (southWestLatitude + northEastLatitude) / 2;
        double centerLongitude = (southWestLongitude + northEastLongitude) / 2;

        return pinsByPlaceId.entrySet().stream()
                .map(entry -> toPlaceItem(placesById.get(entry.getKey()), entry.getValue(), authorsById))
                .sorted(Comparator.comparingDouble(item -> distanceToCenter(
                        item, centerLatitude, centerLongitude)))
                .toList();
    }

    private TaggedPlaceItem toPlaceItem(Place place, List<Pin> placePins, Map<Long, Member> authorsById) {
        List<ActivePinResponse> activePins = placePins.stream()
                .map(pin -> new ActivePinResponse(
                        pin.getId(),
                        pin.getCaptureLocation().getY(),
                        pin.getCaptureLocation().getX(),
                        authorsById.get(pin.getMember().getId()).getViewAngle()))
                .toList();

        return new TaggedPlaceItem(
                place.getId(),
                place.getName(),
                place.getAddressName(),
                place.getPhone(),
                place.getLocation().getY(),
                place.getLocation().getX(),
                activePins);
    }

    private double distanceToCenter(TaggedPlaceItem item, double centerLat, double centerLng) {
        return haversineMeters(centerLat, centerLng, item.latitude(), item.longitude());
    }

    private double haversineMeters(double lat1, double lng1, double lat2, double lng2) {
        double earthRadiusMeters = 6_371_000.0;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return earthRadiusMeters * c;
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
