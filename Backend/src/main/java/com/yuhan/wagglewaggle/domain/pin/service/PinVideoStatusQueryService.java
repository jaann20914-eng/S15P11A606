package com.yuhan.wagglewaggle.domain.pin.service;

import com.yuhan.wagglewaggle.domain.pin.dto.PinVideoStatusResult;
import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import com.yuhan.wagglewaggle.domain.pin.repository.PinRepository;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * 등록한 핀의 AI 영상 처리 상태 조회(GET /api/v1/pins/{pinId}/status) 애플리케이션 서비스.
 *
 * <p>현재 핀의 videoStatus만 조회한다. 메시지의 pinId나 AiBlurJob을 함께 조회하지 않는다.
 * 삭제 여부(deletedAt)나 영상 만료 여부(expiresAt)로 핀을 PIN_NOT_FOUND 처리하지 않는다.
 * 영상 만료 판정은 다음 단계(Presigned GET URL 발급)에서 수행한다.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PinVideoStatusQueryService {

    private final PinRepository pinRepository;

    /**
     * 인증 회원이 게시한 핀의 영상 처리 상태를 조회한다.
     *
     * <ol>
     *   <li>pinId로 핀을 조회한다. 없으면 PIN_NOT_FOUND(404).</li>
     *   <li>현재 회원이 게시자인지 확인한다. 아니면 PIN_STATUS_READ_FORBIDDEN(403).
     *       (다른 사용자의 핀을 404로 숨기지 않는다.)</li>
     *   <li>videoStatus에 맞는 내부 결과 모델을 반환한다.</li>
     * </ol>
     * 예상치 못한 오류는 PIN_STATUS_READ_FAILED(500)로 매핑한다.
     */
    @Transactional(readOnly = true)
    public PinVideoStatusResult getVideoStatus(Long memberId, UUID pinId) {
        try {
            Pin pin = pinRepository.findById(pinId)
                    .orElseThrow(() -> new CustomException(ErrorCode.PIN_NOT_FOUND));

            if (!pin.getMember().getId().equals(memberId)) {
                throw new CustomException(ErrorCode.PIN_STATUS_READ_FORBIDDEN);
            }

            return toResult(pin);
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
}
