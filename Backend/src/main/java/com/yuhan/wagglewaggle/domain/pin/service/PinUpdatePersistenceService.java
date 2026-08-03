package com.yuhan.wagglewaggle.domain.pin.service;

import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJob;
import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJobStatus;
import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJobType;
import com.yuhan.wagglewaggle.domain.blur.repository.AiBlurJobRepository;
import com.yuhan.wagglewaggle.domain.pin.dto.ValidatedPinUpdate;
import com.yuhan.wagglewaggle.domain.pin.entity.CrowdLevel;
import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import com.yuhan.wagglewaggle.domain.pin.entity.PinTag;
import com.yuhan.wagglewaggle.domain.pin.entity.VideoStatus;
import com.yuhan.wagglewaggle.domain.pin.repository.PinRepository;
import com.yuhan.wagglewaggle.domain.pin.repository.PinTagRepository;
import com.yuhan.wagglewaggle.domain.place.entity.Place;
import com.yuhan.wagglewaggle.domain.place.repository.PlaceRepository;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * 핀 수정 반영 트랜잭션 경계.
 *
 * <p>Pin 행을 비관적 잠금으로 조회한 뒤 일반 정보 변경 · PinTag 교체 · AiBlurJob(PENDING) 생성을
 * 하나의 트랜잭션으로 처리한다. 하나라도 실패하면 전체가 롤백된다(AiBlurJob 저장 실패 시 일반 정보도 롤백).</p>
 *
 * <p>영상 관련 Pin 필드(originalVideoKey·blurredVideoKey·thumbnailKey·videoStatus·expiresAt)는
 * 바꾸지 않는다. 기존 공개 영상과 videoStatus=ACTIVE를 유지한다.</p>
 */
@Service
@RequiredArgsConstructor
public class PinUpdatePersistenceService {

    private static final GeometryFactory GEOMETRY_FACTORY =
            new GeometryFactory(new PrecisionModel(), 4326);

    private final PinRepository pinRepository;
    private final PlaceRepository placeRepository;
    private final PinTagRepository pinTagRepository;
    private final AiBlurJobRepository aiBlurJobRepository;

    /**
     * 검증을 통과한 수정 요청을 반영한다.
     *
     * @param validated           검증 통과 신뢰값
     * @param replacementVideoKey 영상 교체 요청이면 원본 영상 키, 아니면 null
     */
    @Transactional
    public Result apply(ValidatedPinUpdate validated, String replacementVideoKey) {
        // 비관적 잠금으로 조회한다. 동일 Pin에 대한 동시 요청은 여기서 직렬화된다.
        Pin pin = pinRepository.findByIdForUpdate(validated.pinId())
                .orElseThrow(() -> new CustomException(ErrorCode.PIN_NOT_FOUND));

        // 잠금 획득 이후 상태를 재확인한다(검증과 잠금 사이의 상태 변화 방어).
        reverifyEditable(pin, validated.memberId());

        boolean videoReplacement = replacementVideoKey != null;
        // 동시 영상 교체 방지: 잠금 하에서 진행 중 PENDING 교체 작업을 원자적으로 확인한다.
        if (videoReplacement && aiBlurJobRepository.existsByPinIdAndJobTypeAndStatus(
                pin.getId(), AiBlurJobType.VIDEO_REPLACEMENT, AiBlurJobStatus.PENDING)) {
            throw new CustomException(ErrorCode.PIN_UPDATE_IN_PROGRESS);
        }

        List<String> updatedFields = new ArrayList<>();
        // 커밋 이후 점수 재계산 대상 placeId(중복 제거).
        Set<Long> placeIdsToRecalculate = new LinkedHashSet<>();

        applyPlace(pin, validated, updatedFields, placeIdsToRecalculate);
        applyCaptureLocation(pin, validated, updatedFields);
        applyDetailLocation(pin, validated, updatedFields);
        applyCrowdLevel(pin, validated, updatedFields, placeIdsToRecalculate);
        applyMemo(pin, validated, updatedFields);
        applyTags(pin, validated, updatedFields);

        AiBlurJob aiBlurJob = null;
        if (videoReplacement) {
            aiBlurJob = AiBlurJob.create(
                    pin.getId(), replacementVideoKey, AiBlurJobType.VIDEO_REPLACEMENT);
            aiBlurJobRepository.save(aiBlurJob);
        }

        return new Result(pin.getVideoStatus(), List.copyOf(updatedFields), aiBlurJob,
                List.copyOf(placeIdsToRecalculate));
    }

    private void reverifyEditable(Pin pin, Long memberId) {
        if (pin.getDeletedAt() != null || isExpired(pin.getExpiresAt())) {
            throw new CustomException(ErrorCode.PIN_NOT_FOUND);
        }
        if (memberId == null || !memberId.equals(pin.getMember().getId())) {
            throw new CustomException(ErrorCode.PIN_UPDATE_FORBIDDEN);
        }
        if (pin.getVideoStatus() != VideoStatus.ACTIVE) {
            throw new CustomException(ErrorCode.PIN_NOT_EDITABLE);
        }
    }

    private boolean isExpired(Instant expiresAt) {
        return expiresAt != null && !expiresAt.isAfter(Instant.now());
    }

    /** placeId가 실제로 바뀌면 반영하고, 기존·새 Place를 점수 재계산 대상에 넣는다. */
    private void applyPlace(Pin pin, ValidatedPinUpdate validated,
                            List<String> updatedFields, Set<Long> placeIdsToRecalculate) {
        if (!validated.placeChanged()) {
            return;
        }
        Long oldPlaceId = pin.getPlace().getId();
        Long newPlaceId = validated.finalPlace().getId();
        if (Objects.equals(oldPlaceId, newPlaceId)) {
            return; // 같은 장소 → 실제 변경 아님
        }
        Place newPlace = placeRepository.getReferenceById(newPlaceId);
        pin.changePlace(newPlace);
        updatedFields.add("placeId");
        placeIdsToRecalculate.add(oldPlaceId);
        placeIdsToRecalculate.add(newPlaceId);
    }

    /** 촬영 좌표가 실제로 바뀌면 반영한다(변경된 축만 updatedFields에 담는다). */
    private void applyCaptureLocation(Pin pin, ValidatedPinUpdate validated, List<String> updatedFields) {
        if (!validated.captureChanged()) {
            return;
        }
        Point existing = pin.getCaptureLocation();
        double oldLat = existing.getY();
        double oldLng = existing.getX();
        double newLat = validated.finalCaptureLatitude();
        double newLng = validated.finalCaptureLongitude();
        boolean latChanged = oldLat != newLat;
        boolean lngChanged = oldLng != newLng;
        if (!latChanged && !lngChanged) {
            return;
        }
        pin.changeCaptureLocation(point(newLng, newLat));
        if (latChanged) {
            updatedFields.add("latitude");
        }
        if (lngChanged) {
            updatedFields.add("longitude");
        }
    }

    /** detailLocation: 생략=유지, 명시적 null=삭제, 값=변경. 실제로 바뀐 경우만 반영·기록. */
    private void applyDetailLocation(Pin pin, ValidatedPinUpdate validated, List<String> updatedFields) {
        if (!validated.detailLocation().isPresent()) {
            return;
        }
        String newValue = validated.detailLocation().value(); // null이면 삭제
        if (!Objects.equals(pin.getDetailLocation(), newValue)) {
            pin.changeDetailLocation(newValue);
            updatedFields.add("detailLocation");
        }
    }

    /** crowdLevel이 실제로 바뀌면 반영하고 최종 Place를 점수 재계산 대상에 넣는다. */
    private void applyCrowdLevel(Pin pin, ValidatedPinUpdate validated,
                                 List<String> updatedFields, Set<Long> placeIdsToRecalculate) {
        if (!validated.crowdLevel().isPresent()) {
            return;
        }
        CrowdLevel newValue = validated.crowdLevel().value();
        if (pin.getCrowdLevel() != newValue) {
            pin.changeCrowdLevel(newValue);
            updatedFields.add("crowdLevel");
            // 최종 Place(placeId가 함께 바뀌었다면 새 Place)의 점수를 재계산한다.
            placeIdsToRecalculate.add(pin.getPlace().getId());
        }
    }

    /** memo: 생략=유지, 명시적 null=삭제, 값=변경. 실제로 바뀐 경우만 반영·기록. */
    private void applyMemo(Pin pin, ValidatedPinUpdate validated, List<String> updatedFields) {
        if (!validated.memo().isPresent()) {
            return;
        }
        String newValue = validated.memo().value(); // null이면 삭제
        if (!Objects.equals(pin.getMemo(), newValue)) {
            pin.changeMemo(newValue);
            updatedFields.add("memo");
        }
    }

    /** tags: 전달되면 요청 태그로 교체(빈 목록=전체 삭제). 기존 태그와 동일하면 변경으로 보지 않는다. */
    private void applyTags(Pin pin, ValidatedPinUpdate validated, List<String> updatedFields) {
        if (!validated.tags().isPresent()) {
            return;
        }
        List<String> newTags = validated.tags().value(); // 정규화 완료, 빈 목록 가능
        List<PinTag> existing = pinTagRepository.findByPin_Id(pin.getId());
        Set<String> oldSet = new LinkedHashSet<>();
        for (PinTag tag : existing) {
            oldSet.add(tag.getTag());
        }
        Set<String> newSet = new LinkedHashSet<>(newTags);
        if (oldSet.equals(newSet)) {
            return; // 결과 태그 집합이 동일 → 실제 변경 아님
        }
        if (!existing.isEmpty()) {
            pinTagRepository.deleteAll(existing);
            pinTagRepository.flush(); // unique(pin_id, tag) 충돌 방지: 삭제를 먼저 반영
        }
        for (String tag : newTags) {
            pinTagRepository.save(PinTag.create(pin, tag));
        }
        updatedFields.add("tags");
    }

    private Point point(double longitude, double latitude) {
        Point point = GEOMETRY_FACTORY.createPoint(new Coordinate(longitude, latitude));
        point.setSRID(4326);
        return point;
    }

    /**
     * 반영 결과.
     *
     * @param videoStatus           변경되지 않은 현재 영상 상태(ACTIVE)
     * @param updatedFields         실제 DB 값이 바뀐 필드
     * @param aiBlurJob             영상 교체로 생성된 PENDING 작업(없으면 null)
     * @param placeIdsToRecalculate 커밋 이후 점수 재계산 대상 placeId
     */
    public record Result(
            VideoStatus videoStatus,
            List<String> updatedFields,
            AiBlurJob aiBlurJob,
            List<Long> placeIdsToRecalculate
    ) {
    }
}
