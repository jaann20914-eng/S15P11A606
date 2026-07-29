package com.yuhan.wagglewaggle.domain.place.service;

import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import com.yuhan.wagglewaggle.domain.pin.repository.PinRepository;
import com.yuhan.wagglewaggle.domain.place.client.KakaoLocalClient;
import com.yuhan.wagglewaggle.domain.place.client.dto.KakaoKeywordResponse;
import com.yuhan.wagglewaggle.domain.place.client.dto.KakaoKeywordResponse.Document;
import com.yuhan.wagglewaggle.domain.place.dto.ActivePinResponse;
import com.yuhan.wagglewaggle.domain.place.dto.PlaceFilter;
import com.yuhan.wagglewaggle.domain.place.dto.PlaceListItem;
import com.yuhan.wagglewaggle.domain.place.dto.PlaceListResponse;
import com.yuhan.wagglewaggle.domain.place.entity.Place;
import com.yuhan.wagglewaggle.domain.place.repository.PlaceRepository;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class PlacePinService {

    private static final int MAX_RESULT = 10;
    private static final int MAX_KAKAO_CONCURRENCY = 8;
    private static final Duration ACTIVE_WINDOW = Duration.ofHours(1);

    private static final int KAKAO_RADIUS = 10;
    private static final int KAKAO_PAGE = 1;
    private static final int KAKAO_SIZE = 5;
    private static final String KAKAO_SORT = "distance";

    private final PlaceRepository placeRepository;
    private final PinRepository pinRepository;
    private final KakaoLocalClient kakaoLocalClient;

    @Transactional(readOnly = true)
    public PlaceListResponse getPlacesInMapRange(
            double southWestLatitude, double southWestLongitude,
            double northEastLatitude, double northEastLongitude, String filterParam) {

        validateMapRange(southWestLatitude, southWestLongitude, northEastLatitude, northEastLongitude);
        PlaceFilter filter = PlaceFilter.from(filterParam);

        Instant now = Instant.now();
        Instant from = now.minus(ACTIVE_WINDOW);

        // 1. bounds 내에 있는 장소핀 가져오기
        List<Place> places = placeRepository.findWithinBounds(
                southWestLongitude, southWestLatitude, northEastLongitude, northEastLatitude);
        if (places.isEmpty()) {
            return new PlaceListResponse(List.of());
        }

        // 2. places에서 찍은 영상핀 가져오기
        Map<Long, List<Pin>> pinsByPlaceId = pinRepository.findValidPins(places.stream().map(Place::getId).toList(), from, now)
                .stream()
                .collect(Collectors.groupingBy(pin -> pin.getPlace().getId()));

        double centerLatitude = (southWestLatitude + northEastLatitude) / 2;
        double centerLongitude = (southWestLongitude + northEastLongitude) / 2;

        // 3. 혼잡도 필터링
        List<Candidate> candidates = places.stream()
                .map(place -> toCandidate(place, pinsByPlaceId.getOrDefault(place.getId(), List.of()),
                        centerLatitude, centerLongitude))
                .filter(candidate -> matchesFilter(candidate, filter))
                .sorted(Comparator.comparingDouble(Candidate::distance))
                .limit(MAX_RESULT)
                .toList();

        if (candidates.isEmpty()) {
            return new PlaceListResponse(List.of());
        }

        return new PlaceListResponse(fetchKakaoDetails(candidates));
    }

    private void validateMapRange(double swLat, double swLng, double neLat, double neLng) {
        boolean outOfRange = swLat < -90 || swLat > 90 || neLat < -90 || neLat > 90
                || swLng < -180 || swLng > 180 || neLng < -180 || neLng > 180;
        if (outOfRange || swLat >= neLat || swLng >= neLng) {
            throw new CustomException(ErrorCode.INVALID_MAP_RANGE);
        }
    }

    private Candidate toCandidate(Place place, List<Pin> validPins, double centerLat, double centerLng) {
        Double average = averageCrowdLevel(validPins);
        String label = crowdLabel(average);
        List<ActivePinResponse> activePins = validPins.stream()
                .map(pin -> new ActivePinResponse(
                        pin.getId(),
                        pin.getCaptureLocation().getY(),
                        pin.getCaptureLocation().getX(),
                        pin.getMember().getViewAngle()))
                .toList();
        double distance = haversineMeters(
                centerLat, centerLng, place.getLocation().getY(), place.getLocation().getX());
        return new Candidate(place, average, label, activePins, distance);
    }

    /**
     * 유효 핀의 혼잡도 가중치 평균을 소수점 첫째 자리까지 반올림한다. 핀이 없으면 null.
     */
    private Double averageCrowdLevel(List<Pin> validPins) {
        if (validPins.isEmpty()) {
            return null;
        }
        double average = validPins.stream()
                .mapToInt(pin -> pin.getCrowdLevel().getWeight())
                .average()
                .orElseThrow();
        return Math.round(average * 10) / 10.0;
    }

    private String crowdLabel(Double average) {
        if (average == null) {
            return null;
        }
        return average < 3.0 ? "RELAXED" : "WAGLE";
    }

    private boolean matchesFilter(Candidate candidate, PlaceFilter filter) {
        if (filter == null) {
            return true;
        }
        Double average = candidate.average();
        if (average == null) {
            return false;
        }
        return switch (filter) {
            case RELAXED -> average >= 1.0 && average < 3.0;
            case WAGLE -> average >= 3.0 && average <= 4.0;
        };
    }

    /**
     * 최종 후보 장소별로 카카오 Local API를 제한 병렬로 호출해 주소·전화번호를 채운다.
     * 하나라도 실패/타임아웃하면 부분 응답을 내지 않고 전체를 PLACES_FETCH_FAILED로 처리한다.
     */
    private List<PlaceListItem> fetchKakaoDetails(List<Candidate> candidates) {
        int concurrency = Math.max(1, Math.min(candidates.size(), MAX_KAKAO_CONCURRENCY));
        try (ExecutorService executor = Executors.newFixedThreadPool(concurrency)) {
            List<Future<PlaceListItem>> futures = candidates.stream()
                    .map(candidate -> executor.submit(() -> toPlaceListItem(candidate)))
                    .toList();
            List<PlaceListItem> items = new ArrayList<>(futures.size());
            for (Future<PlaceListItem> future : futures) {
                items.add(future.get());
            }
            return items;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.error("카카오 장소 상세 조회 인터럽트", e);
            throw new CustomException(ErrorCode.PLACES_FETCH_FAILED);
        } catch (ExecutionException e) {
            log.error("카카오 장소 상세 조회 실패", e.getCause());
            throw new CustomException(ErrorCode.PLACES_FETCH_FAILED);
        }
    }

    private PlaceListItem toPlaceListItem(Candidate candidate) {
        Place place = candidate.place();
        Document matched = findMatchingDocument(place);

        String address = "";
        String phone = "";
        if (matched != null) {
            address = resolveAddress(matched);
            phone = (matched.phone() != null && !matched.phone().isBlank()) ? matched.phone() : "";
        }

        return new PlaceListItem(
                place.getId(),
                place.getName(),
                address,
                phone,
                place.getLocation().getY(),
                place.getLocation().getX(),
                candidate.average(),
                candidate.label(),
                candidate.activePins());
    }

    /**
     * 카카오 검색 결과(최대 5건) 중 DB kakao_place_id와 문자열이 정확히 일치하는 항목을 찾는다. 없으면 null.
     */
    private Document findMatchingDocument(Place place) {
        KakaoKeywordResponse response = kakaoLocalClient.searchNearby(
                place.getName(),
                place.getLocation().getX(),
                place.getLocation().getY(),
                KAKAO_RADIUS, KAKAO_PAGE, KAKAO_SIZE, KAKAO_SORT);
        if (response == null || response.documents() == null) {
            return null;
        }
        return response.documents().stream()
                .filter(document -> place.getKakaoPlaceId().equals(document.id()))
                .findFirst()
                .orElse(null);
    }

    private String resolveAddress(Document document) {
        if (document.roadAddressName() != null && !document.roadAddressName().isBlank()) {
            return document.roadAddressName();
        }
        if (document.addressName() != null && !document.addressName().isBlank()) {
            return document.addressName();
        }
        return "";
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

    private record Candidate(
            Place place,
            Double average,
            String label,
            List<ActivePinResponse> activePins,
            double distance
    ) {
    }
}
