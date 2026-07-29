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

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
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
    private static final Duration CACHE_TTL = Duration.ofSeconds(30);

    private static final int KAKAO_RADIUS = 10;
    private static final int KAKAO_PAGE = 1;
    private static final int KAKAO_SIZE = 5;
    private static final String KAKAO_SORT = "distance";

    private final PlaceRepository placeRepository;
    private final PinRepository pinRepository;
    private final KakaoLocalClient kakaoLocalClient;

    private final Map<BoundsKey, CacheEntry> aggregateCache = new ConcurrentHashMap<>();

    public PlaceListResponse getPlacesInMapRange(
            double southWestLatitude, double southWestLongitude,
            double northEastLatitude, double northEastLongitude, String filterParam) {

        validateMapRange(southWestLatitude, southWestLongitude, northEastLatitude, northEastLongitude);
        PlaceFilter filter = PlaceFilter.from(filterParam);

        // 1. bbox 집계(장소 + 유효 핀)를 캐시에서 가져온다. 필터와 무관하게 동일하므로 재사용된다.
        BoundsKey key = new BoundsKey(
                southWestLatitude, southWestLongitude, northEastLatitude, northEastLongitude);
        List<PlaceAggregate> aggregates = getAggregates(key);
        if (aggregates.isEmpty()) {
            return new PlaceListResponse(List.of());
        }

        double centerLatitude = (southWestLatitude + northEastLatitude) / 2;
        double centerLongitude = (southWestLongitude + northEastLongitude) / 2;

        // 2. 필터·거리 정렬·상한만 필터별로 다르게 적용한다.
        List<PlaceAggregate> selected = aggregates.stream()
                .filter(aggregate -> matchesFilter(aggregate.averageCrowdLevel(), filter))
                .sorted(Comparator.comparingDouble(aggregate -> distanceToCenter(
                        aggregate, centerLatitude, centerLongitude)))
                .limit(MAX_RESULT)
                .toList();

        if (selected.isEmpty()) {
            return new PlaceListResponse(List.of());
        }

        // 3. 최종 후보만 카카오 실시간 조회로 주소·전화번호를 채운다.
        return new PlaceListResponse(fetchKakaoDetails(selected));
    }

    /**
     * bbox 키로 집계 결과를 캐시에서 조회한다. 만료(30초)됐거나 없으면 DB에서 다시 집계한다.
     * 캐시에는 DB에서 파생한 데이터만 담고, 카카오 주소·전화번호는 담지 않는다.
     */
    private List<PlaceAggregate> getAggregates(BoundsKey key) {
        Instant now = Instant.now();
        CacheEntry cached = aggregateCache.get(key);
        if (cached != null && cached.expiresAt().isAfter(now)) {
            return cached.aggregates();
        }
        List<PlaceAggregate> aggregates = loadAggregates(key, now);
        aggregateCache.values().removeIf(entry -> !entry.expiresAt().isAfter(now));
        aggregateCache.put(key, new CacheEntry(aggregates, now.plus(CACHE_TTL)));
        return aggregates;
    }

    /**
     * bbox 내 장소와 최근 1시간 유효 핀을 조회해 장소별 집계 스냅샷을 만든다.
     * JOIN FETCH로 member를 함께 로딩하므로 트랜잭션 밖에서도 스냅샷을 구성할 수 있다.
     */
    private List<PlaceAggregate> loadAggregates(BoundsKey key, Instant now) {
        Instant from = now.minus(ACTIVE_WINDOW);

        List<Place> places = placeRepository.findWithinBounds(
                key.southWestLongitude(), key.southWestLatitude(),
                key.northEastLongitude(), key.northEastLatitude());
        if (places.isEmpty()) {
            return List.of();
        }

        Map<Long, List<Pin>> pinsByPlaceId = pinRepository
                .findValidPins(places.stream().map(Place::getId).toList(), from, now)
                .stream()
                .collect(Collectors.groupingBy(pin -> pin.getPlace().getId()));

        return places.stream()
                .map(place -> toAggregate(place, pinsByPlaceId.getOrDefault(place.getId(), List.of())))
                .toList();
    }

    private PlaceAggregate toAggregate(Place place, List<Pin> validPins) {
        Double average = averageCrowdLevel(validPins);
        String label = crowdLabel(average);
        List<ActivePinResponse> activePins = validPins.stream()
                .map(pin -> new ActivePinResponse(
                        pin.getId(),
                        pin.getCaptureLocation().getY(),
                        pin.getCaptureLocation().getX(),
                        pin.getMember().getViewAngle()))
                .toList();
        return new PlaceAggregate(
                place.getId(),
                place.getKakaoPlaceId(),
                place.getName(),
                place.getLocation().getY(),
                place.getLocation().getX(),
                average,
                label,
                activePins);
    }

    private void validateMapRange(double swLat, double swLng, double neLat, double neLng) {
        boolean outOfRange = swLat < -90 || swLat > 90 || neLat < -90 || neLat > 90
                || swLng < -180 || swLng > 180 || neLng < -180 || neLng > 180;
        if (outOfRange || swLat >= neLat || swLng >= neLng) {
            throw new CustomException(ErrorCode.INVALID_MAP_RANGE);
        }
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

    private boolean matchesFilter(Double average, PlaceFilter filter) {
        if (filter == null) {
            return true;
        }
        if (average == null) {
            return false;
        }
        return switch (filter) {
            case RELAXED -> average >= 1.0 && average < 3.0;
            case WAGLE -> average >= 3.0 && average <= 4.0;
        };
    }

    private double distanceToCenter(PlaceAggregate aggregate, double centerLat, double centerLng) {
        return haversineMeters(centerLat, centerLng, aggregate.latitude(), aggregate.longitude());
    }

    /**
     * 최종 후보 장소별로 카카오 Local API를 제한 병렬로 호출해 주소·전화번호를 채운다.
     * 하나라도 실패/타임아웃하면 부분 응답을 내지 않고 전체를 PLACES_FETCH_FAILED로 처리한다.
     */
    private List<PlaceListItem> fetchKakaoDetails(List<PlaceAggregate> aggregates) {
        int concurrency = Math.max(1, Math.min(aggregates.size(), MAX_KAKAO_CONCURRENCY));
        try (ExecutorService executor = Executors.newFixedThreadPool(concurrency)) {
            List<Future<PlaceListItem>> futures = aggregates.stream()
                    .map(aggregate -> executor.submit(() -> toPlaceListItem(aggregate)))
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

    private PlaceListItem toPlaceListItem(PlaceAggregate aggregate) {
        Document matched = findMatchingDocument(aggregate);

        String address = "";
        String phone = "";
        if (matched != null) {
            address = resolveAddress(matched);
            phone = (matched.phone() != null && !matched.phone().isBlank()) ? matched.phone() : "";
        }

        return new PlaceListItem(
                aggregate.placeId(),
                aggregate.name(),
                address,
                phone,
                aggregate.latitude(),
                aggregate.longitude(),
                aggregate.averageCrowdLevel(),
                aggregate.crowdLabel(),
                aggregate.activePins());
    }

    /**
     * 카카오 검색 결과(최대 5건) 중 DB kakao_place_id와 문자열이 정확히 일치하는 항목을 찾는다. 없으면 null.
     */
    private Document findMatchingDocument(PlaceAggregate aggregate) {
        KakaoKeywordResponse response = kakaoLocalClient.searchNearby(
                aggregate.name(),
                aggregate.longitude(),
                aggregate.latitude(),
                KAKAO_RADIUS, KAKAO_PAGE, KAKAO_SIZE, KAKAO_SORT);
        if (response == null || response.documents() == null) {
            return null;
        }
        return response.documents().stream()
                .filter(document -> aggregate.kakaoPlaceId().equals(document.id()))
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

    /**
     * bbox 집계 스냅샷. 카카오 주소·전화번호를 제외한 DB 파생 데이터만 담아 캐시한다.
     */
    private record PlaceAggregate(
            Long placeId,
            String kakaoPlaceId,
            String name,
            double latitude,
            double longitude,
            Double averageCrowdLevel,
            String crowdLabel,
            List<ActivePinResponse> activePins
    ) {
    }

    private record BoundsKey(
            double southWestLatitude,
            double southWestLongitude,
            double northEastLatitude,
            double northEastLongitude
    ) {
    }

    private record CacheEntry(
            List<PlaceAggregate> aggregates,
            Instant expiresAt
    ) {
    }
}
