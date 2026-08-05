package com.yuhan.wagglewaggle.domain.pin.service;

import com.yuhan.wagglewaggle.domain.pin.dto.PinDetail;
import com.yuhan.wagglewaggle.domain.pin.dto.PinDetailResponse;
import com.yuhan.wagglewaggle.domain.pin.dto.PinDetailView;
import com.yuhan.wagglewaggle.domain.pin.dto.PinViewerAccess;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import com.yuhan.wagglewaggle.global.s3.S3PresignedUrlGenerator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * 영상 핀 상세 조회(GET /api/v1/pins/{pinId})의 응답 조립 애플리케이션 서비스.
 *
 * <p>pinId 파싱(형식 검증), 조회 가능한 핀의 기본 데이터·현재 사용자 기준 접근 정보 조회
 * ({@link PinDetailQueryService}), 데이터 정합성 검증, 블러 영상·썸네일 Presigned GET URL 발급,
 * 외부 응답 DTO 조립을 담당한다. 원본 영상 URL·객체 키·내부 memberId는 응답에 노출하지 않는다.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PinDetailService {

    private final PinDetailQueryService pinDetailQueryService;
    private final S3PresignedUrlGenerator s3PresignedUrlGenerator;

    /**
     * 핀 상세 응답을 조립한다.
     *
     * <ol>
     *   <li>pinId 형식을 검증한다. 잘못되면 INVALID_PIN_ID(400).</li>
     *   <li>조회 가능한(ACTIVE·미삭제·미만료) 핀과 현재 사용자 기준 접근 정보를 조회한다.
     *       조회할 수 없으면 PIN_NOT_FOUND(404).</li>
     *   <li>ACTIVE 핀에 blurredVideoKey·thumbnailKey가 하나라도 없으면 부분 응답을 내지 않고
     *       PIN_DETAIL_FETCH_FAILED(500).</li>
     *   <li>블러 영상·썸네일 Presigned GET URL을 발급한다. 하나라도 실패하면 부분 응답을 내지 않고
     *       MEDIA_URL_ISSUE_FAILED(503).</li>
     * </ol>
     * 위 명시적 오류 외의 예기치 못한 조회 실패는 PIN_DETAIL_FETCH_FAILED(500)로 매핑한다.
     */
    public PinDetailResponse getPinDetail(String rawPinId, Long currentMemberId) {
        UUID pinId = parsePinId(rawPinId);
        try {
            PinDetailView view = pinDetailQueryService.getPinDetail(pinId, currentMemberId);
            return assembleResponse(view);
        } catch (CustomException e) {
            throw e;
        } catch (Exception e) {
            log.error("핀 상세 조회 실패 (pinId={}, memberId={})", pinId, currentMemberId, e);
            throw new CustomException(ErrorCode.PIN_DETAIL_FETCH_FAILED);
        }
    }

    /**
     * pinId(경로 변수)를 UUID로 파싱한다. 형식이 올바르지 않으면 INVALID_PIN_ID.
     */
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

    /**
     * 조회 결과에 정합성 검증과 Presigned URL 발급을 적용해 외부 응답 DTO로 조립한다.
     */
    private PinDetailResponse assembleResponse(PinDetailView view) {
        PinDetail detail = view.detail();
        PinViewerAccess access = view.access();

        // ACTIVE 핀인데 블러 영상·썸네일 키가 하나라도 없으면 부분 응답을 내지 않고 데이터 불일치로 처리한다.
        if (isBlank(detail.blurredVideoKey()) || isBlank(detail.thumbnailKey())) {
            log.error("ACTIVE 핀의 영상 키 누락 (pinId={}, blurredKeyPresent={}, thumbnailKeyPresent={})",
                    detail.pinId(), !isBlank(detail.blurredVideoKey()), !isBlank(detail.thumbnailKey()));
            throw new CustomException(ErrorCode.PIN_DETAIL_FETCH_FAILED);
        }

        String videoUrl = createDownloadUrl(detail.blurredVideoKey());
        String thumbnailUrl = createDownloadUrl(detail.thumbnailKey());

        PinDetailResponse.PlaceDetail place = new PinDetailResponse.PlaceDetail(
                detail.placeId(),
                detail.kakaoPlaceId(),
                detail.placeName(),
                detail.latitude(),
                detail.longitude());

        return new PinDetailResponse(
                detail.pinId(),
                detail.authorViewAngle(),
                detail.authorNickname(),
                detail.createdAt(),
                detail.expiresAt(),
                place,
                detail.crowdLevel(),
                detail.detailLocation(),
                detail.memo(),
                detail.tags(),
                access.videoAccess(),
                access.isEvaluated(),
                videoUrl,
                thumbnailUrl,
                access.canRequestChat(),
                access.chatRequestState(),
                detail.publisherStatus());
    }

    /**
     * 지정한 객체 키로 Presigned GET URL을 발급한다.
     * 첫 URL 발급 후 두 번째가 실패하더라도 부분 응답을 내지 않도록, 발급 실패는 MEDIA_URL_ISSUE_FAILED로 매핑한다.
     */
    private String createDownloadUrl(String key) {
        try {
            return s3PresignedUrlGenerator.createDownloadUrl(key);
        } catch (Exception e) {
            log.error("Presigned GET URL 발급 실패", e);
            throw new CustomException(ErrorCode.MEDIA_URL_ISSUE_FAILED);
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
