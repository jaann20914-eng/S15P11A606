package com.yuhan.wagglewaggle.domain.place.service;

import com.yuhan.wagglewaggle.domain.place.client.KakaoLocalClient;
import com.yuhan.wagglewaggle.domain.place.client.dto.KakaoKeywordResponse;
import com.yuhan.wagglewaggle.domain.place.client.dto.KakaoKeywordResponse.Document;
import com.yuhan.wagglewaggle.domain.place.dto.PlaceSearchResponse;
import com.yuhan.wagglewaggle.domain.place.dto.PlaceSearchResult;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpStatusCodeException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClientException;

import java.util.Comparator;
import java.util.List;

@Service
@Slf4j
public class PlaceService {

    private static final int DEFAULT_SEARCH_RADIUS_METERS = 50;

    private final KakaoLocalClient kakaoLocalClient;

    public PlaceService(KakaoLocalClient kakaoLocalClient) {
        this.kakaoLocalClient = kakaoLocalClient;
    }

    public PlaceSearchResponse searchPlaces(String q, double latitude, double longitude, Integer radius) {
        String keyword = validateSearchQuery(q, latitude, longitude);
        int searchRadius = (radius != null) ? radius : DEFAULT_SEARCH_RADIUS_METERS;

        KakaoKeywordResponse response = callKakaoForSearch(keyword, latitude, longitude, searchRadius);

        List<Document> documents = response.documents();
        if (documents == null || documents.isEmpty()) {
            return new PlaceSearchResponse(List.of());
        }

        List<PlaceSearchResult> results = documents.stream()
                .map(document -> toSearchResult(document, latitude, longitude))
                .toList();

        return new PlaceSearchResponse(results);
    }

    private String validateSearchQuery(String q, double latitude, double longitude) {
        if (q == null) {
            throw new CustomException(ErrorCode.INVALID_PLACE_SEARCH_QUERY);
        }
        String keyword = q.trim();
        boolean invalidCoordinates = latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180;
        if (keyword.isEmpty() || invalidCoordinates) {
            throw new CustomException(ErrorCode.INVALID_PLACE_SEARCH_QUERY);
        }
        return keyword;
    }

    private KakaoKeywordResponse callKakaoForSearch(String keyword, double latitude, double longitude, int radius) {
        try {
            return kakaoLocalClient.searchKeyword(keyword, latitude, longitude, radius);
        } catch (HttpStatusCodeException e) {
            log.error("카카오 장소 검색 오류 응답: {}", e.getMessage(), e);
            throw new CustomException(ErrorCode.EXTERNAL_PLACE_API_ERROR);
        } catch (ResourceAccessException e) {
            log.error("카카오 장소 검색 연결 실패/타임아웃: {}", e.getMessage(), e);
            throw new CustomException(ErrorCode.EXTERNAL_PLACE_API_UNAVAILABLE);
        } catch (RestClientException e) {
            log.error("카카오 장소 검색 실패: {}", e.getMessage(), e);
            throw new CustomException(ErrorCode.EXTERNAL_PLACE_API_ERROR);
        }
    }

    private PlaceSearchResult toSearchResult(Document document, double centerLatitude, double centerLongitude) {
        String address = (document.roadAddressName() != null && !document.roadAddressName().isBlank())
                ? document.roadAddressName()
                : (document.addressName() != null ? document.addressName() : "");
        double placeLatitude = Double.parseDouble(document.y());
        double placeLongitude = Double.parseDouble(document.x());
        int distanceMeters = (int) Math.round(resolveDistanceMeters(
                document.distance(), centerLatitude, centerLongitude, placeLatitude, placeLongitude));

        return new PlaceSearchResult(
                document.id(),
                document.placeName(),
                address,
                placeLatitude,
                placeLongitude,
                distanceMeters
        );
    }

    /**
     * 카카오가 distance를 준 경우 그대로 사용하고, 비어 있으면 사용자가 보낸 장소 좌표로 직접 계산한다.
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
     * 하버사진 공식: 두 점 사이의 지구 표면 거리 계산
     */
    private double haversineMeters(double lat1, double lng1, double lat2, double lng2) {
        double EARTH_RADIUS_METERS = 6_371_000.0;

        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return EARTH_RADIUS_METERS * c;
    }
}
