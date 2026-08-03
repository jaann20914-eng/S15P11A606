package com.yuhan.wagglewaggle.domain.recommendation.service;

import com.yuhan.wagglewaggle.domain.recommendation.cache.GpsLocation;
import com.yuhan.wagglewaggle.domain.recommendation.cache.GpsLocationCacheStore;
import com.yuhan.wagglewaggle.domain.recommendation.dto.LocationSource;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Optional;

/**
 * 추천 요청의 위치를 결정한다(요청 좌표 → 유효한 최근 GPS 캐시 순).
 * 정책:
 * - 좌표는 둘 다 전달하거나 둘 다 생략해야 한다. 한쪽만 있거나 범위를 벗어나면 INVALID_LOCATION.
 * - 둘 다 전달되면 CURRENT_GPS로 사용하고 최근 GPS 캐시에 저장한다(저장 실패는 무시).
 * - 둘 다 생략되면 유효한 GPS 캐시를 사용해 CACHED_GPS로 한다. 없으면 LOCATION_NOT_AVAILABLE.
 * - GPS 캐시 저장소 조회 자체가 실패하면 RECOMMENDATION_FETCH_FAILED.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class LocationResolver {

    private final GpsLocationCacheStore gpsLocationCacheStore;

    public ResolvedLocation resolve(Long memberId, Double latitude, Double longitude) {
        boolean hasLatitude = latitude != null;
        boolean hasLongitude = longitude != null;

        // 좌표는 둘 다 전달하거나 둘 다 생략해야 한다.
        if (hasLatitude != hasLongitude) {
            throw new CustomException(ErrorCode.INVALID_LOCATION);
        }

        if (hasLatitude) {
            if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) {
                throw new CustomException(ErrorCode.INVALID_LOCATION);
            }
            saveGpsQuietly(memberId, latitude, longitude);
            return new ResolvedLocation(latitude, longitude, LocationSource.CURRENT_GPS);
        }

        // 좌표 생략 → 유효한 최근 GPS 캐시 사용
        Optional<GpsLocation> cached;
        try {
            cached = gpsLocationCacheStore.find(memberId);
        } catch (Exception e) {
            log.error("GPS 캐시 조회 실패 (memberId={})", memberId, e);
            throw new CustomException(ErrorCode.RECOMMENDATION_FETCH_FAILED);
        }
        GpsLocation location = cached.orElseThrow(() -> new CustomException(ErrorCode.LOCATION_NOT_AVAILABLE));
        return new ResolvedLocation(location.latitude(), location.longitude(), LocationSource.CACHED_GPS);
    }

    private void saveGpsQuietly(Long memberId, double latitude, double longitude) {
        try {
            gpsLocationCacheStore.save(memberId, new GpsLocation(latitude, longitude, Instant.now()));
        } catch (Exception e) {
            // 캐시 저장 실패만으로 요청을 실패시키지 않는다.
            log.warn("GPS 캐시 저장 실패 → 무시 (memberId={}): {}", memberId, e.getMessage());
        }
    }

    private boolean isValidLatitude(double latitude) {
        return latitude >= -90.0 && latitude <= 90.0;
    }

    private boolean isValidLongitude(double longitude) {
        return longitude >= -180.0 && longitude <= 180.0;
    }
}
