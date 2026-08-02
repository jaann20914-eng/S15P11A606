package com.yuhan.wagglewaggle.global.geo;

/**
 * 두 위경도 좌표 간 대권 거리(미터)를 Haversine 공식으로 계산한다.
 * 지구 반경 6,371,000m는 핀 등록 검증에서 쓰던 값과 동일하다.
 */
public final class GeoDistanceCalculator {

    private static final double EARTH_RADIUS_METERS = 6_371_000.0;

    private GeoDistanceCalculator() {
    }

    public static double haversineMeters(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return EARTH_RADIUS_METERS * c;
    }
}
