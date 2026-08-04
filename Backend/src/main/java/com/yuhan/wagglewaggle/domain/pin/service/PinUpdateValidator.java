package com.yuhan.wagglewaggle.domain.pin.service;

import com.yuhan.wagglewaggle.domain.pin.dto.PinUpdateRequest;
import com.yuhan.wagglewaggle.domain.pin.dto.ValidatedPinUpdate;
import com.yuhan.wagglewaggle.domain.pin.entity.CrowdLevel;
import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import com.yuhan.wagglewaggle.domain.pin.entity.VideoStatus;
import com.yuhan.wagglewaggle.domain.pin.repository.PinRepository;
import com.yuhan.wagglewaggle.domain.place.entity.Place;
import com.yuhan.wagglewaggle.domain.place.repository.PlaceRepository;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import com.yuhan.wagglewaggle.global.geo.GeoDistanceCalculator;
import com.yuhan.wagglewaggle.global.jackson.PatchField;
import com.yuhan.wagglewaggle.global.text.GraphemeCounter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.locationtech.jts.geom.Point;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * 핀 수정(PATCH /api/v1/pins/{pinId}) 요청 검증 오케스트레이션.
 *
 * <p>이번 단계에서는 실제 Pin·PinTag 변경, AiBlurJob 생성, 메시지 발행을 하지 않고
 * 요청 유효성만 검증한 뒤 신뢰값({@link ValidatedPinUpdate})을 반환한다.</p>
 *
 * <p>검증 순서</p>
 * <ol>
 *   <li>pinId 형식 → INVALID_PIN_ID(400)</li>
 *   <li>존재·미삭제·미만료 → PIN_NOT_FOUND(404)</li>
 *   <li>작성자 확인 → PIN_UPDATE_FORBIDDEN(403)</li>
 *   <li>ACTIVE 상태 → PIN_NOT_EDITABLE(409)</li>
 *   <li>요청 필드 검증 → INVALID_PIN_UPDATE_REQUEST(400)</li>
 *   <li>최종 장소·좌표 계산과 거리 → PLACE_NOT_FOUND(404) / LOCATION_OUT_OF_RANGE(422)</li>
 * </ol>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PinUpdateValidator {

    // 장소 좌표와 촬영 좌표 허용 거리(스펙 고정값 50m).
    private static final double MAX_CAPTURE_DISTANCE_METERS = 50.0;

    private static final int MAX_ORIGINAL_VIDEO_KEY_LENGTH = 1024;
    private static final int MAX_DETAIL_LOCATION_LENGTH = 100;
    private static final int MAX_MEMO_LENGTH = 50;

    private final PinRepository pinRepository;
    private final PlaceRepository placeRepository;
    private final PinTagNormalizer pinTagNormalizer;

    public ValidatedPinUpdate validate(Long memberId, String rawPinId, PinUpdateRequest request) {
        // 1. pinId 형식
        UUID pinId = parsePinId(rawPinId);

        if (request == null) {
            throw new CustomException(ErrorCode.INVALID_PIN_UPDATE_REQUEST);
        }

        // 2~4. 존재·미삭제·미만료 → 작성자 → ACTIVE
        Pin pin = loadEditablePin(pinId, memberId);

        // 5. 요청 필드 검증(값 자체의 형식·범위·태그 정규화)
        validateRequestFields(request);

        // 6. 최종 장소·좌표 계산과 거리 검증
        ResolvedPlace place = resolvePlace(request, pin);
        ResolvedCapture capture = resolveCapture(request, pin);
        validateWithinRange(place, capture);

        return buildCommand(pinId, memberId, request, place, capture);
    }

    private UUID parsePinId(String rawPinId) {
        if (rawPinId == null || rawPinId.isBlank()) {
            throw new CustomException(ErrorCode.INVALID_PIN_ID);
        }
        try {
            return UUID.fromString(rawPinId.trim());
        } catch (IllegalArgumentException e) {
            throw new CustomException(ErrorCode.INVALID_PIN_ID);
        }
    }

    /** 존재·미삭제·미만료 → 작성자 → ACTIVE 순으로 확인하고 수정 가능한 핀을 반환한다. */
    private Pin loadEditablePin(UUID pinId, Long memberId) {
        Pin pin = pinRepository.findByIdWithMemberAndPlace(pinId)
                .orElseThrow(() -> new CustomException(ErrorCode.PIN_NOT_FOUND));

        // 삭제되었거나 만료된 핀은 존재하지 않는 것과 동일하게 취급한다.
        if (pin.getDeletedAt() != null || isExpired(pin.getExpiresAt())) {
            throw new CustomException(ErrorCode.PIN_NOT_FOUND);
        }

        if (memberId == null || !memberId.equals(pin.getMember().getId())) {
            throw new CustomException(ErrorCode.PIN_UPDATE_FORBIDDEN);
        }

        if (pin.getVideoStatus() != VideoStatus.ACTIVE) {
            throw new CustomException(ErrorCode.PIN_NOT_EDITABLE);
        }
        return pin;
    }

    /** 만료 여부는 UTC Instant 기준. 만료 시각이 없으면(null) 만료되지 않은 것으로 본다. */
    private boolean isExpired(Instant expiresAt) {
        return expiresAt != null && !expiresAt.isAfter(Instant.now());
    }

    private void validateRequestFields(PinUpdateRequest r) {
        // 수정 필드가 하나도 없으면 잘못된 요청
        if (!r.hasAnyField()) {
            throw new CustomException(ErrorCode.INVALID_PIN_UPDATE_REQUEST);
        }

        // latitude·longitude는 반드시 함께 전달되어야 한다(하나만 전달 시 오류).
        if (r.latitude().isPresent() != r.longitude().isPresent()) {
            throw new CustomException(ErrorCode.INVALID_PIN_UPDATE_REQUEST);
        }

        // 좌표: 전달됐다면 null이 아니고 유효 범위여야 한다(삭제 불가 필드).
        if (r.latitude().isPresent()
                && (!isValidLatitude(r.latitude().value()) || !isValidLongitude(r.longitude().value()))) {
            throw new CustomException(ErrorCode.INVALID_PIN_UPDATE_REQUEST);
        }

        // originalVideoKey: 전달됐다면 null·공백 불가, 1024자 이하.
        if (r.originalVideoKey().isPresent()) {
            String key = r.originalVideoKey().value();
            if (key == null || key.isBlank() || key.length() > MAX_ORIGINAL_VIDEO_KEY_LENGTH) {
                throw new CustomException(ErrorCode.INVALID_PIN_UPDATE_REQUEST);
            }
        }

        // placeId: 전달됐다면 null 불가(삭제 불가 필드).
        if (r.placeId().isPresent() && r.placeId().value() == null) {
            throw new CustomException(ErrorCode.INVALID_PIN_UPDATE_REQUEST);
        }

        // crowdLevel: 전달됐다면 허용 값이어야 한다.
        if (r.crowdLevel().isPresent()) {
            parseCrowdLevel(r.crowdLevel().value());
        }

        // detailLocation: null=삭제 허용, 값이면 100자 이하.
        if (r.detailLocation().hasValue() && r.detailLocation().value().length() > MAX_DETAIL_LOCATION_LENGTH) {
            throw new CustomException(ErrorCode.INVALID_PIN_UPDATE_REQUEST);
        }

        // memo: null=삭제 허용, 값이면 50자 이하(사람이 보는 글자 수 = 자소 클러스터 기준).
        if (r.memo().hasValue() && GraphemeCounter.count(r.memo().value()) > MAX_MEMO_LENGTH) {
            throw new CustomException(ErrorCode.INVALID_PIN_UPDATE_REQUEST);
        }

        // tags: 전달됐다면 정규화·검증(빈 목록/null=전체 삭제). 위반 시 INVALID_PIN_UPDATE_REQUEST.
        if (r.tags().isPresent()) {
            pinTagNormalizer.normalizeAndValidate(r.tags().value(), ErrorCode.INVALID_PIN_UPDATE_REQUEST);
        }
    }

    private CrowdLevel parseCrowdLevel(String rawCrowdLevel) {
        if (rawCrowdLevel == null || rawCrowdLevel.isBlank()) {
            throw new CustomException(ErrorCode.INVALID_PIN_UPDATE_REQUEST);
        }
        try {
            return CrowdLevel.valueOf(rawCrowdLevel.trim());
        } catch (IllegalArgumentException e) {
            throw new CustomException(ErrorCode.INVALID_PIN_UPDATE_REQUEST);
        }
    }

    /**
     * 최종 장소를 계산한다.
     * placeId 생략 → 기존 장소 유지. 전달 → places 테이블 조회(없으면 PLACE_NOT_FOUND).
     * 이 API에서 새 Kakao 장소를 생성하지 않는다.
     */
    private ResolvedPlace resolvePlace(PinUpdateRequest request, Pin pin) {
        if (!request.placeId().isPresent()) {
            return ResolvedPlace.unchanged(pin.getPlace());
        }
        Long placeId = request.placeId().value();
        Place place = placeRepository.findById(placeId)
                .orElseThrow(() -> new CustomException(ErrorCode.PLACE_NOT_FOUND));
        return ResolvedPlace.changed(place);
    }

    /**
     * 최종 촬영 좌표를 계산한다.
     * latitude·longitude 생략 → 기존 촬영 좌표 유지. 함께 전달 → 새 좌표.
     * (JTS Point는 x=경도, y=위도)
     */
    private ResolvedCapture resolveCapture(PinUpdateRequest request, Pin pin) {
        if (request.latitude().isPresent()) {
            return ResolvedCapture.changed(request.latitude().value(), request.longitude().value());
        }
        Point existing = pin.getCaptureLocation();
        return ResolvedCapture.unchanged(existing.getY(), existing.getX());
    }

    private void validateWithinRange(ResolvedPlace place, ResolvedCapture capture) {
        Point placeLocation = place.place().getLocation();
        double meters = GeoDistanceCalculator.haversineMeters(
                placeLocation.getY(), placeLocation.getX(),
                capture.latitude(), capture.longitude());
        if (meters > MAX_CAPTURE_DISTANCE_METERS) {
            throw new CustomException(ErrorCode.LOCATION_OUT_OF_RANGE);
        }
    }

    private ValidatedPinUpdate buildCommand(UUID pinId, Long memberId, PinUpdateRequest request,
                                            ResolvedPlace place, ResolvedCapture capture) {
        PatchField<CrowdLevel> crowdLevel = request.crowdLevel().isPresent()
                ? PatchField.of(parseCrowdLevel(request.crowdLevel().value()))
                : PatchField.absent();

        PatchField<List<String>> tags = request.tags().isPresent()
                ? PatchField.of(pinTagNormalizer.normalizeAndValidate(
                        request.tags().value(), ErrorCode.INVALID_PIN_UPDATE_REQUEST))
                : PatchField.absent();

        return new ValidatedPinUpdate(
                pinId,
                memberId,
                request.originalVideoKey(),
                place.place(),
                place.changed(),
                capture.latitude(),
                capture.longitude(),
                capture.changed(),
                crowdLevel,
                request.detailLocation(),
                request.memo(),
                tags
        );
    }

    private boolean isValidLatitude(Double latitude) {
        return latitude != null && latitude >= -90.0 && latitude <= 90.0;
    }

    private boolean isValidLongitude(Double longitude) {
        return longitude != null && longitude >= -180.0 && longitude <= 180.0;
    }

    /** 최종 장소와 변경 여부. */
    private record ResolvedPlace(Place place, boolean changed) {
        static ResolvedPlace unchanged(Place place) {
            return new ResolvedPlace(place, false);
        }

        static ResolvedPlace changed(Place place) {
            return new ResolvedPlace(place, true);
        }
    }

    /** 최종 촬영 좌표와 변경 여부. */
    private record ResolvedCapture(double latitude, double longitude, boolean changed) {
        static ResolvedCapture unchanged(double latitude, double longitude) {
            return new ResolvedCapture(latitude, longitude, false);
        }

        static ResolvedCapture changed(double latitude, double longitude) {
            return new ResolvedCapture(latitude, longitude, true);
        }
    }
}
