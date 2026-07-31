package com.yuhan.wagglewaggle.domain.pin.service;

import com.yuhan.wagglewaggle.domain.blur.repository.AiBlurJobRepository;
import com.yuhan.wagglewaggle.domain.pin.dto.PinCreateRequest;
import com.yuhan.wagglewaggle.domain.pin.dto.ValidatedPinCreation;
import com.yuhan.wagglewaggle.domain.pin.entity.CrowdLevel;
import com.yuhan.wagglewaggle.domain.pin.repository.PinRepository;
import com.yuhan.wagglewaggle.domain.place.client.KakaoLocalClient;
import com.yuhan.wagglewaggle.domain.place.client.dto.KakaoKeywordResponse;
import com.yuhan.wagglewaggle.domain.place.entity.Place;
import com.yuhan.wagglewaggle.domain.place.repository.PlaceRepository;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import com.yuhan.wagglewaggle.global.properties.PinRegistrationProperties;
import com.yuhan.wagglewaggle.global.properties.PinUploadProperties;
import com.yuhan.wagglewaggle.global.s3.S3ObjectInspector;
import com.yuhan.wagglewaggle.global.s3.S3VideoObjectMetadata;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 핀 등록(POST /api/v1/pins) 요청 검증 오케스트레이션.
 * 이번 단계에서는 Pin·AiBlurJob 저장이나 메시지 발행 없이 요청 유효성만 검증하고,
 * 검증을 통과한 신뢰값(ValidatedPinCreation)을 반환한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PinCreateService {

    // 원본 영상 Content-Type은 video/mp4로만 허용한다(업로드 정책과 동일).
    private static final String ALLOWED_CONTENT_TYPE = "video/mp4";

    // 원본 영상 객체 키 형식: pins/original/{memberId}/{uuid}.mp4
    private static final Pattern ORIGINAL_VIDEO_KEY_PATTERN = Pattern.compile(
            "^pins/original/(\\d+)/"
                    + "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\\.mp4$");

    // 장소 좌표와 촬영 좌표 허용 거리(스펙 고정값 50m).
    private static final double MAX_CAPTURE_DISTANCE_METERS = 50.0;

    // DB에 없는 장소를 Kakao로 확인할 때 촬영 좌표 주변을 검색할 반경(Kakao 허용 최대 20km).
    private static final int KAKAO_SEARCH_RADIUS_METERS = 20_000;

    private static final int MAX_ORIGINAL_VIDEO_KEY_LENGTH = 1024;
    private static final int MAX_KAKAO_PLACE_ID_LENGTH = 200;
    private static final int MAX_PLACE_NAME_LENGTH = 100;
    private static final int MAX_DETAIL_LOCATION_LENGTH = 100;
    private static final int MAX_MEMO_LENGTH = 50;

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final double EARTH_RADIUS_METERS = 6_371_000.0;

    private final S3ObjectInspector s3ObjectInspector;
    private final PinRepository pinRepository;
    private final AiBlurJobRepository aiBlurJobRepository;
    private final PlaceRepository placeRepository;
    private final KakaoLocalClient kakaoLocalClient;
    private final PinTagNormalizer pinTagNormalizer;
    private final PinUploadProperties pinUploadProperties;
    private final PinRegistrationProperties pinRegistrationProperties;

    public ValidatedPinCreation validate(Long memberId, PinCreateRequest request) {
        if (request == null) {
            throw new CustomException(ErrorCode.INVALID_REQUEST);
        }

        validateFields(request);
        CrowdLevel crowdLevel = parseCrowdLevel(request.crowdLevel());

        // 1. 일일 등록 제한
        checkDailyLimit(memberId);

        // 2~3. 객체 키 형식과 사용자 경로 일치
        validateVideoObjectKey(request.originalVideoKey(), memberId);

        // 4~6. S3 실존·Content-Type·크기
        validateVideoObject(request.originalVideoKey());

        // 7. 영상 중복 사용 여부(Pin / AiBlurJob)
        checkVideoNotAlreadyRegistered(request.originalVideoKey());

        // 8~11. 신뢰 장소 확인 후 촬영 좌표와의 거리 검증
        ResolvedPlace place = resolvePlace(request);
        validateCaptureWithinRange(place, request.latitude(), request.longitude());

        // 12~15. 태그 정규화·검증
        List<String> tags = pinTagNormalizer.normalizeAndValidate(request.tags());

        return new ValidatedPinCreation(
                memberId,
                request.originalVideoKey(),
                request.kakaoPlaceId(),
                place.name(),
                place.latitude(),
                place.longitude(),
                request.latitude(),
                request.longitude(),
                request.detailLocation(),
                crowdLevel,
                request.memo(),
                tags
        );
    }

    private void validateFields(PinCreateRequest r) {
        boolean invalid = isBlank(r.originalVideoKey()) || r.originalVideoKey().length() > MAX_ORIGINAL_VIDEO_KEY_LENGTH
                || isBlank(r.kakaoPlaceId()) || r.kakaoPlaceId().length() > MAX_KAKAO_PLACE_ID_LENGTH
                || isBlank(r.placeName()) || r.placeName().length() > MAX_PLACE_NAME_LENGTH
                || !isValidLatitude(r.kakaoPlaceLatitude()) || !isValidLongitude(r.kakaoPlaceLongitude())
                || !isValidLatitude(r.latitude()) || !isValidLongitude(r.longitude())
                || (r.detailLocation() != null && r.detailLocation().length() > MAX_DETAIL_LOCATION_LENGTH)
                || (r.memo() != null && r.memo().length() > MAX_MEMO_LENGTH);
        if (invalid) {
            throw new CustomException(ErrorCode.INVALID_REQUEST);
        }
    }

    private CrowdLevel parseCrowdLevel(String rawCrowdLevel) {
        if (isBlank(rawCrowdLevel)) {
            throw new CustomException(ErrorCode.INVALID_REQUEST);
        }
        try {
            return CrowdLevel.valueOf(rawCrowdLevel.trim());
        } catch (IllegalArgumentException e) {
            throw new CustomException(ErrorCode.INVALID_CROWD_LEVEL);
        }
    }

    private void checkDailyLimit(Long memberId) {
        int dailyLimit = pinRegistrationProperties.dailyLimit();
        if (dailyLimit <= 0) {
            return; // 정책값 미적용
        }
        Instant startOfToday = LocalDate.now(KST).atStartOfDay(KST).toInstant();
        long todayCount = pinRepository.countByMember_IdAndCreatedAtGreaterThanEqual(memberId, startOfToday);
        if (todayCount >= dailyLimit) {
            throw new CustomException(ErrorCode.DAILY_PIN_LIMIT_EXCEEDED);
        }
    }

    private void validateVideoObjectKey(String originalVideoKey, Long memberId) {
        Matcher matcher = ORIGINAL_VIDEO_KEY_PATTERN.matcher(originalVideoKey);
        if (!matcher.matches()) {
            throw new CustomException(ErrorCode.VIDEO_NOT_ACCESSIBLE);
        }
        long keyMemberId;
        try {
            keyMemberId = Long.parseLong(matcher.group(1));
        } catch (NumberFormatException e) {
            throw new CustomException(ErrorCode.VIDEO_NOT_ACCESSIBLE);
        }
        if (memberId == null || memberId != keyMemberId) {
            throw new CustomException(ErrorCode.VIDEO_NOT_ACCESSIBLE);
        }
    }

    private void validateVideoObject(String originalVideoKey) {
        S3VideoObjectMetadata metadata = s3ObjectInspector.findObjectMetadata(originalVideoKey)
                .orElseThrow(() -> new CustomException(ErrorCode.VIDEO_NOT_ACCESSIBLE));
        if (!ALLOWED_CONTENT_TYPE.equals(metadata.contentType())) {
            throw new CustomException(ErrorCode.VIDEO_NOT_ACCESSIBLE);
        }
        if (metadata.contentLength() > pinUploadProperties.maxVideoSizeBytes()) {
            throw new CustomException(ErrorCode.VIDEO_NOT_ACCESSIBLE);
        }
    }

    private void checkVideoNotAlreadyRegistered(String originalVideoKey) {
        if (pinRepository.existsByOriginalVideoKey(originalVideoKey)
                || aiBlurJobRepository.existsByOriginalVideoKey(originalVideoKey)) {
            throw new CustomException(ErrorCode.VIDEO_ALREADY_REGISTERED);
        }
    }

    private ResolvedPlace resolvePlace(PinCreateRequest request) {
        return placeRepository.findFirstByKakaoPlaceId(request.kakaoPlaceId())
                .map(this::toResolvedPlace)
                .orElseGet(() -> resolvePlaceFromKakao(request));
    }

    private ResolvedPlace toResolvedPlace(Place place) {
        // JTS Point는 x=경도, y=위도로 저장한다.
        return new ResolvedPlace(place.getName(), place.getLocation().getY(), place.getLocation().getX());
    }

    private ResolvedPlace resolvePlaceFromKakao(PinCreateRequest request) {
        KakaoKeywordResponse response = kakaoLocalClient.searchKeyword(
                request.placeName(), request.latitude(), request.longitude(), KAKAO_SEARCH_RADIUS_METERS);
        if (response == null || response.documents() == null) {
            throw new CustomException(ErrorCode.PLACE_NOT_FOUND);
        }
        return response.documents().stream()
                .filter(document -> request.kakaoPlaceId().equals(document.id()))
                .findFirst()
                .map(document -> new ResolvedPlace(
                        document.placeName(),
                        Double.parseDouble(document.y()),
                        Double.parseDouble(document.x())))
                .orElseThrow(() -> new CustomException(ErrorCode.PLACE_NOT_FOUND));
    }

    private void validateCaptureWithinRange(ResolvedPlace place, double captureLat, double captureLng) {
        double meters = haversineMeters(place.latitude(), place.longitude(), captureLat, captureLng);
        if (meters > MAX_CAPTURE_DISTANCE_METERS) {
            throw new CustomException(ErrorCode.LOCATION_OUT_OF_RANGE);
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private boolean isValidLatitude(Double latitude) {
        return latitude != null && latitude >= -90.0 && latitude <= 90.0;
    }

    private boolean isValidLongitude(Double longitude) {
        return longitude != null && longitude >= -180.0 && longitude <= 180.0;
    }

    /** 두 위경도 좌표 간 대권 거리(미터)를 Haversine 공식으로 계산한다. */
    private double haversineMeters(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return EARTH_RADIUS_METERS * c;
    }

    /** DB 또는 Kakao API에서 확인한 신뢰 장소 값(장소명·위도·경도). */
    private record ResolvedPlace(String name, double latitude, double longitude) {
    }
}
