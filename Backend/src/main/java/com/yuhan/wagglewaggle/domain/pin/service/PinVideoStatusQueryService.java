package com.yuhan.wagglewaggle.domain.pin.service;

import com.yuhan.wagglewaggle.domain.pin.dto.PinVideoStatusResponse;
import com.yuhan.wagglewaggle.domain.pin.dto.PinVideoStatusResult;
import com.yuhan.wagglewaggle.domain.pin.dto.PinVideoStatusView;
import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import com.yuhan.wagglewaggle.domain.pin.entity.VideoStatus;
import com.yuhan.wagglewaggle.domain.pin.repository.PinRepository;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import com.yuhan.wagglewaggle.global.s3.S3PresignedUrlGenerator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/**
 * 등록한 핀의 AI 영상 처리 상태 조회(GET /api/v1/pins/{pinId}/status) 애플리케이션 서비스.
 *
 * <p>현재 핀의 videoStatus만 조회한다. 메시지의 pinId나 AiBlurJob을 함께 조회하지 않는다.
 * 삭제 여부(deletedAt)나 영상 만료 여부(expiresAt)로 핀을 PIN_NOT_FOUND 처리하지 않는다.</p>
 *
 * <p>ACTIVE이면서 만료되지 않은(expiresAt이 현재 시각 이후) 경우에만 블러 영상·썸네일의
 * Presigned GET URL을 함께 발급한다. 그 외 상태에서는 Presigned URL 생성기를 호출하지 않으며
 * 두 URL은 항상 함께 null이다(부분 URL 금지).</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PinVideoStatusQueryService {

    private final PinRepository pinRepository;
    private final S3PresignedUrlGenerator s3PresignedUrlGenerator;

    /**
     * 인증 회원이 게시한 핀의 영상 처리 상태와(발급 조건 충족 시) 영상 URL을 조회한다.
     *
     * <ol>
     *   <li>pinId로 핀을 조회한다. 없으면 PIN_NOT_FOUND(404).</li>
     *   <li>현재 회원이 게시자인지 확인한다. 아니면 PIN_STATUS_READ_FORBIDDEN(403).
     *       (다른 사용자의 핀을 404로 숨기지 않는다.)</li>
     *   <li>videoStatus에 맞는 안내 문구와 응답 데이터를 조립한다.</li>
     * </ol>
     * 예상치 못한 오류는 PIN_STATUS_READ_FAILED(500)로 매핑한다.
     */
    @Transactional(readOnly = true)
    public PinVideoStatusView getVideoStatus(Long memberId, UUID pinId) {
        try {
            Pin pin = pinRepository.findById(pinId)
                    .orElseThrow(() -> new CustomException(ErrorCode.PIN_NOT_FOUND));

            if (!pin.getMember().getId().equals(memberId)) {
                throw new CustomException(ErrorCode.PIN_STATUS_READ_FORBIDDEN);
            }

            PinVideoStatusResult result = toResult(pin);
            PinVideoStatusResponse data = assembleResponse(result);
            return new PinVideoStatusView(result.message(), data);
        } catch (CustomException e) {
            throw e;
        } catch (Exception e) {
            log.error("핀 영상 처리 상태 조회 실패 (memberId={}, pinId={})", memberId, pinId, e);
            throw new CustomException(ErrorCode.PIN_STATUS_READ_FAILED);
        }
    }

    private PinVideoStatusResult toResult(Pin pin) {
        return switch (pin.getVideoStatus()) {
            case PENDING -> PinVideoStatusResult.pending(pin.getId());
            case ACTIVE -> PinVideoStatusResult.active(
                    pin.getId(), pin.getBlurredVideoKey(), pin.getThumbnailKey(), pin.getExpiresAt());
            case REJECTED -> PinVideoStatusResult.rejected(pin.getId());
            case FAILED -> PinVideoStatusResult.failed(pin.getId());
        };
    }

    /**
     * 상태별 응답 데이터를 조립한다.
     * ACTIVE가 아니거나 만료된 ACTIVE는 URL을 발급하지 않는다(생성기 미호출).
     * 만료되지 않은 ACTIVE에서 키가 누락되면 내부 데이터 불일치로 판단해 PIN_STATUS_READ_FAILED로 처리한다.
     */
    private PinVideoStatusResponse assembleResponse(PinVideoStatusResult result) {
        if (result.videoStatus() != VideoStatus.ACTIVE) {
            return PinVideoStatusResponse.withoutUrls(result.pinId(), result.videoStatus());
        }

        // 만료된(또는 만료 시각이 없는) ACTIVE는 URL을 발급하지 않되 상태는 ACTIVE로 유지한다.
        if (isExpired(result.expiresAt())) {
            return PinVideoStatusResponse.withoutUrls(result.pinId(), VideoStatus.ACTIVE);
        }

        // 만료되지 않은 ACTIVE인데 키가 하나라도 없으면 부분 URL을 반환하지 않고 데이터 불일치로 처리한다.
        if (isBlank(result.blurredVideoKey()) || isBlank(result.thumbnailKey())) {
            log.error("ACTIVE 핀의 영상 키 누락 (pinId={}, blurredKeyPresent={}, thumbnailKeyPresent={})",
                    result.pinId(), !isBlank(result.blurredVideoKey()), !isBlank(result.thumbnailKey()));
            throw new CustomException(ErrorCode.PIN_STATUS_READ_FAILED);
        }

        String videoUrl = s3PresignedUrlGenerator.createDownloadUrl(result.blurredVideoKey());
        String thumbnailUrl = s3PresignedUrlGenerator.createDownloadUrl(result.thumbnailKey());
        return PinVideoStatusResponse.withUrls(result.pinId(), videoUrl, thumbnailUrl);
    }

    /** 만료 여부는 UTC Instant 기준으로 비교한다. 만료 시각이 없으면 URL 발급 불가로 본다. */
    private boolean isExpired(Instant expiresAt) {
        return expiresAt == null || !expiresAt.isAfter(Instant.now());
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
