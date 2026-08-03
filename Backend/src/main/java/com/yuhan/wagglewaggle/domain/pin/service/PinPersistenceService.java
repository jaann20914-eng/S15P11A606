package com.yuhan.wagglewaggle.domain.pin.service;

import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJob;
import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJobType;
import com.yuhan.wagglewaggle.domain.blur.repository.AiBlurJobRepository;
import com.yuhan.wagglewaggle.domain.pin.dto.ValidatedPinCreation;
import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import com.yuhan.wagglewaggle.domain.pin.entity.PinTag;
import com.yuhan.wagglewaggle.domain.pin.repository.PinRepository;
import com.yuhan.wagglewaggle.domain.pin.repository.PinTagRepository;
import com.yuhan.wagglewaggle.domain.place.entity.Place;
import com.yuhan.wagglewaggle.domain.place.repository.PlaceRepository;
import com.yuhan.wagglewaggle.domain.user.entity.Member;
import com.yuhan.wagglewaggle.domain.user.repository.MemberRepository;
import lombok.RequiredArgsConstructor;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 핀 등록 저장 트랜잭션 경계.
 * 장소 확보(재사용 또는 신규 저장) → Pin → PinTag → AiBlurJob(INITIAL_UPLOAD)을
 * 하나의 트랜잭션으로 저장하며, 하나라도 실패하면 전체가 롤백된다.
 * 외부 I/O(S3·Kakao) 검증은 이 트랜잭션 밖에서 이미 끝난 신뢰값(ValidatedPinCreation)만 받는다.
 */
@Service
@RequiredArgsConstructor
public class PinPersistenceService {

    private static final GeometryFactory GEOMETRY_FACTORY =
            new GeometryFactory(new PrecisionModel(), 4326);

    private final MemberRepository memberRepository;
    private final PlaceRepository placeRepository;
    private final PinRepository pinRepository;
    private final PinTagRepository pinTagRepository;
    private final AiBlurJobRepository aiBlurJobRepository;

    @Transactional
    public Result save(ValidatedPinCreation validated) {
        Place place = resolveOrCreatePlace(validated);
        Member member = memberRepository.getReferenceById(validated.memberId());

        // 5. videoStatus는 Pin 기본값 PENDING으로 저장한다. 만료 정책 미확정이라 expiresAt은 null.
        Pin pin = Pin.create(
                member,
                place,
                validated.crowdLevel(),
                point(validated.captureLongitude(), validated.captureLatitude()),
                validated.detailLocation(),
                validated.memo(),
                validated.originalVideoKey(),
                null);
        pinRepository.save(pin);

        // 6. 정규화된 태그를 PinTag로 저장한다.
        for (String tag : validated.tags()) {
            pinTagRepository.save(PinTag.create(pin, tag));
        }

        // 7~11. 최초 등록 AI 블러 작업(INITIAL_UPLOAD, PENDING, 원본 영상 키)을 저장한다.
        AiBlurJob aiBlurJob = AiBlurJob.create(
                pin.getId(), validated.originalVideoKey(), AiBlurJobType.INITIAL_UPLOAD);
        aiBlurJobRepository.save(aiBlurJob);

        return new Result(pin, aiBlurJob);
    }

    /**
     * kakaoPlaceId로 기존 장소를 재사용하고, 없으면 서버가 확인한 정보로 새 장소를 저장한다.
     */
    private Place resolveOrCreatePlace(ValidatedPinCreation validated) {
        return placeRepository.findFirstByKakaoPlaceId(validated.kakaoPlaceId())
                .orElseGet(() -> placeRepository.save(Place.create(
                        validated.kakaoPlaceId(),
                        validated.resolvedPlaceName(),
                        point(validated.placeLongitude(), validated.placeLatitude()),
                        validated.categoryGroupCode(),
                        validated.categoryGroupName(),
                        validated.phone(),
                        validated.addressName())));
    }

    private Point point(double longitude, double latitude) {
        Point point = GEOMETRY_FACTORY.createPoint(new Coordinate(longitude, latitude));
        point.setSRID(4326);
        return point;
    }

    /** 저장 결과. 응답 구성용 Pin과 발행 대상 AiBlurJob을 함께 반환한다. */
    public record Result(Pin pin, AiBlurJob aiBlurJob) {
    }
}
