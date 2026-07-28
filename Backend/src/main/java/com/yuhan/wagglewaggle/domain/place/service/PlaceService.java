package com.yuhan.wagglewaggle.domain.place.service;

import com.yuhan.wagglewaggle.domain.place.client.KakaoLocalClient;
import com.yuhan.wagglewaggle.domain.place.client.dto.KakaoKeywordResponse;
import com.yuhan.wagglewaggle.domain.place.client.dto.KakaoKeywordResponse.Document;
import com.yuhan.wagglewaggle.domain.place.dto.NearbyPlaceSearchResponse;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;

import java.util.Comparator;
import java.util.List;

@Service
@Slf4j
public class PlaceService {

    private final KakaoLocalClient kakaoLocalClient;

    public PlaceService(KakaoLocalClient kakaoLocalClient) {
        this.kakaoLocalClient = kakaoLocalClient;
    }

    public List<NearbyPlaceSearchResponse> findNearby(String keyword, double latitude, double longitude, int radius) {
        validateCoordinates(latitude, longitude);
        validateNearbyRadius(radius);

        KakaoKeywordResponse response = callKakao(keyword, latitude, longitude, radius);

        List<Document> documents = response.documents();
        if (documents == null || documents.isEmpty()) {
            return List.of();
        }

        return documents.stream()
                .map(document -> toResponse(document, latitude, longitude))
                .sorted(Comparator.comparingDouble(NearbyPlaceSearchResponse::distanceMeters))
                .toList();
    }

    private KakaoKeywordResponse callKakao(String keyword, double latitude, double longitude, int radius) {
        try {
            return kakaoLocalClient.searchKeyword(keyword, latitude, longitude, radius);
        } catch (RestClientException e) {
            log.error("카카오 주변 장소 조회 실패: {}", e.getMessage(), e);
            throw new CustomException(ErrorCode.NEARBY_PLACES_FETCH_FAILED);
        }
    }

    private void validateCoordinates(double latitude, double longitude) {
        if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            throw new CustomException(ErrorCode.INVALID_COORDINATES);
        }
    }

    private void validateNearbyRadius(int radius) {
        if (radius <= 0 || radius > 50) {
            throw new CustomException(ErrorCode.INVALID_RADIUS);
        }
    }

    private NearbyPlaceSearchResponse toResponse(Document document, double userLatitude, double userLongitude) {
        String address = (document.roadAddressName() != null && !document.roadAddressName().isBlank())
                ? document.roadAddressName()
                : document.addressName();
        double placeLatitude = Double.parseDouble(document.y());
        double placeLongitude = Double.parseDouble(document.x());
        double distanceMeters = resolveDistanceMeters(
                document.distance(), userLatitude, userLongitude, placeLatitude, placeLongitude);

        return new NearbyPlaceSearchResponse(
                Long.parseLong(document.id()),
                document.placeName(),
                address,
                placeLatitude,
                placeLongitude,
                distanceMeters
        );
    }

    /**
     * 카카오가 distance를 준 경우 그대로 사용하고, 비어 있으면 사용자·장소 좌표로 직접 계산한다.
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
