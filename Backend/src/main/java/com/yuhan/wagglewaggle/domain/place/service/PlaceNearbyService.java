package com.yuhan.wagglewaggle.domain.place.service;

import com.yuhan.wagglewaggle.domain.place.client.KakaoLocalClient;
import com.yuhan.wagglewaggle.domain.place.client.dto.KakaoKeywordResponse;
import com.yuhan.wagglewaggle.domain.place.client.dto.KakaoKeywordResponse.Document;
import com.yuhan.wagglewaggle.domain.place.dto.PlaceNearbyItem;
import com.yuhan.wagglewaggle.domain.place.dto.PlaceNearbyResponse;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientException;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.function.Supplier;

@Service
@Slf4j
@RequiredArgsConstructor
public class PlaceNearbyService {

    // 반경은 50m로 고정한다(요청에서 radius를 받지 않는다).
    private static final int RADIUS_METERS = 1000;
    // 카테고리(또는 키워드)별 최대 후보 수.
    private static final int MAX_PER_CATEGORY = 2;
    // 가까운 순으로 후보를 받기 위해 거리 정렬을 사용한다.
    private static final String SORT_DISTANCE = "distance";
    private static final int KAKAO_PAGE = 1;

    // 카테고리 검색(category.json)으로 조회하는 카카오 카테고리 그룹 코드.
    private static final List<String> CATEGORY_GROUP_CODES = List.of(
            "CE7",  // 카페
            "FD6",  // 맛집(음식점)
            "CT1",  // 전시/문화공간(문화시설)
            "AT4"   // 관광명소
    );
    // 키워드 검색(keyword.json)으로 조회하는 키워드. 카카오 카테고리 그룹 코드가 없는 유형.
    private static final List<String> SEARCH_KEYWORDS = List.of(
            "복합쇼핑몰",
            "공원"
    );

    private final KakaoLocalClient kakaoLocalClient;

    public PlaceNearbyResponse getNearbyPlaces(double latitude, double longitude) {
        validateCoordinates(latitude, longitude);

        List<Document> documents = fetchCandidatesInParallel(latitude, longitude);
        if (documents.isEmpty()) {
            return new PlaceNearbyResponse(List.of());
        }

        List<PlaceNearbyItem> items = documents.stream()
                .map(document -> toNearbyItem(document, latitude, longitude))
                .filter(item -> item.distanceMeters() <= RADIUS_METERS)
                .sorted(Comparator.comparingInt(PlaceNearbyItem::distanceMeters))
                .toList();

        return new PlaceNearbyResponse(items);
    }

    private void validateCoordinates(double latitude, double longitude) {
        boolean invalidCoordinates = latitude < -90 || latitude > 90
                || longitude < -180 || longitude > 180;
        if (invalidCoordinates) {
            throw new CustomException(ErrorCode.INVALID_PLACE_SEARCH_QUERY);
        }
    }

    /**
     * 카테고리 4건 + 키워드 2건, 총 6개의 카카오 검색을 제한 병렬로 호출해 후보를 모은다.
     * 하나라도 실패/타임아웃하면 부분 응답을 내지 않고 전체를 외부 API 오류로 처리한다.
     */
    private List<Document> fetchCandidatesInParallel(double latitude, double longitude) {
        List<Callable<List<Document>>> tasks = new ArrayList<>();
        for (String code : CATEGORY_GROUP_CODES) {
            tasks.add(() -> searchByCategory(code, latitude, longitude));
        }
        for (String keyword : SEARCH_KEYWORDS) {
            tasks.add(() -> searchByKeyword(keyword, latitude, longitude));
        }

        try (ExecutorService executor = Executors.newFixedThreadPool(tasks.size())) {
            List<Future<List<Document>>> futures = tasks.stream()
                    .map(executor::submit)
                    .toList();

            List<Document> merged = new ArrayList<>();
            for (Future<List<Document>> future : futures) {
                merged.addAll(future.get());
            }
            return merged;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.error("카카오 반경 장소 조회 인터럽트", e);
            throw new CustomException(ErrorCode.EXTERNAL_PLACE_API_UNAVAILABLE);
        } catch (ExecutionException e) {
            // 개별 검색에서 던진 CustomException(502/503)을 그대로 전파한다.
            if (e.getCause() instanceof CustomException customException) {
                throw customException;
            }
            log.error("카카오 반경 장소 조회 실패", e.getCause());
            throw new CustomException(ErrorCode.EXTERNAL_PLACE_API_ERROR);
        }
    }

    private List<Document> searchByCategory(String categoryGroupCode, double latitude, double longitude) {
        KakaoKeywordResponse response = callKakao(() -> kakaoLocalClient.searchCategory(
                categoryGroupCode, latitude, longitude, RADIUS_METERS, MAX_PER_CATEGORY, SORT_DISTANCE));
        return limitedDocuments(response);
    }

    private List<Document> searchByKeyword(String keyword, double latitude, double longitude) {
        KakaoKeywordResponse response = callKakao(() -> kakaoLocalClient.searchNearby(
                keyword, longitude, latitude, RADIUS_METERS, KAKAO_PAGE, MAX_PER_CATEGORY, SORT_DISTANCE));
        return limitedDocuments(response);
    }

    private List<Document> limitedDocuments(KakaoKeywordResponse response) {
        if (response == null || response.documents() == null) {
            return List.of();
        }
        return response.documents().stream()
                .limit(MAX_PER_CATEGORY)
                .toList();
    }

    /**
     * 카카오 호출 예외를 서비스 정책에 맞는 에러 코드로 변환한다.
     * 타임아웃/연결 실패는 503, 그 외 오류 응답은 502로 매핑한다(PlaceService와 동일 정책).
     */
    private KakaoKeywordResponse callKakao(Supplier<KakaoKeywordResponse> call) {
        try {
            return call.get();
        } catch (HttpStatusCodeException e) {
            log.error("카카오 반경 장소 조회 오류 응답: {}", e.getMessage(), e);
            throw new CustomException(ErrorCode.EXTERNAL_PLACE_API_ERROR);
        } catch (ResourceAccessException e) {
            log.error("카카오 반경 장소 조회 연결 실패/타임아웃: {}", e.getMessage(), e);
            throw new CustomException(ErrorCode.EXTERNAL_PLACE_API_UNAVAILABLE);
        } catch (RestClientException e) {
            log.error("카카오 반경 장소 조회 실패: {}", e.getMessage(), e);
            throw new CustomException(ErrorCode.EXTERNAL_PLACE_API_ERROR);
        }
    }

    private PlaceNearbyItem toNearbyItem(Document document, double userLatitude, double userLongitude) {
        double placeLatitude = Double.parseDouble(document.y());
        double placeLongitude = Double.parseDouble(document.x());
        int distanceMeters = (int) Math.round(resolveDistanceMeters(
                document.distance(), userLatitude, userLongitude, placeLatitude, placeLongitude));
        String phone = (document.phone() != null && !document.phone().isBlank()) ? document.phone() : "";
        String addressName = document.addressName() != null ? document.addressName() : "";

        return new PlaceNearbyItem(
                document.id(),
                document.placeName(),
                placeLatitude,
                placeLongitude,
                document.categoryGroupCode(),
                document.categoryGroupName(),
                document.categoryName(),
                phone,
                addressName,
                distanceMeters
        );
    }

    /**
     * 카카오가 distance를 준 경우 그대로 사용하고, 비어 있으면 사용자 좌표와 장소 좌표로 직접 계산한다.
     */
    private double resolveDistanceMeters(
            String kakaoDistance,
            double userLatitude,
            double userLongitude,
            double placeLatitude,
            double placeLongitude
    ) {
        if (kakaoDistance != null && !kakaoDistance.isBlank()) {
            return Double.parseDouble(kakaoDistance);
        }
        return haversineMeters(userLatitude, userLongitude, placeLatitude, placeLongitude);
    }

    /**
     * 두 위경도 좌표 간 대권 거리(미터)를 Haversine 공식으로 계산한다.
     */
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
}
