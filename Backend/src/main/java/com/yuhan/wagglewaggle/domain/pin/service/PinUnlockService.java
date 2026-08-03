package com.yuhan.wagglewaggle.domain.pin.service;

import com.yuhan.wagglewaggle.domain.pin.dto.PinUnlockResponse;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import com.yuhan.wagglewaggle.global.s3.S3PresignedUrlGenerator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * 핀 영상 잠금 해제(POST /api/v1/pins/{pinId}/unlock) 애플리케이션 서비스.
 *
 * <p>pinId 형식 검증(INVALID_PIN_ID) → 멱등성 키 검증(IDEMPOTENCY_KEY_REQUIRED·INVALID_IDEMPOTENCY_KEY) →
 * 결제·권한 반영({@link PinUnlockPersistenceService}) → 열람용 Presigned GET URL 발급을 오케스트레이션한다.</p>
 *
 * <p>서로 다른 키의 동시 동일-핀 구매로 유니크 제약이 충돌한 경우
 * ({@link PinUnlockPersistenceService.ConcurrentUnlockException})는 반영 트랜잭션이 롤백된 뒤이므로,
 * 별도 트랜잭션 {@link PinUnlockPersistenceService#reconcileExisting}으로 기존 권한을 재조회해
 * 추가 차감 없이 결과를 확정한다.</p>
 *
 * <p>검증·처리 예외(CustomException: INVALID_PIN_ID·IDEMPOTENCY_KEY_REQUIRED·INVALID_IDEMPOTENCY_KEY·
 * PIN_NOT_FOUND·IDEMPOTENCY_KEY_CONFLICT·INSUFFICIENT_CREDIT)는 그대로 전파한다.
 * 권한·크레딧 처리 중 예상치 못한 실패는 롤백 후 PIN_UNLOCK_FAILED(500)로 매핑하고,
 * 권한 처리 커밋 이후 URL 발급 실패는 권한을 유지한 채 VIDEO_URL_ISSUE_FAILED(503)로 매핑한다.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PinUnlockService {

    private final PinUnlockPersistenceService pinUnlockPersistenceService;
    private final S3PresignedUrlGenerator s3PresignedUrlGenerator;

    /**
     * 잠금 해제 요청을 처리하고 응답을 조립한다.
     *
     * @param memberId         인증 사용자(구매자·작성자) id
     * @param rawPinId         경로 변수 pinId(형식 미검증)
     * @param rawIdempotencyKey {@code Idempotency-Key} 헤더 값(누락 시 null)
     */
    public PinUnlockResponse unlock(Long memberId, String rawPinId, String rawIdempotencyKey) {
        UUID pinId = parsePinId(rawPinId);
        UUID idempotencyKey = parseIdempotencyKey(rawIdempotencyKey);

        PinUnlockPersistenceService.Result result = applyUnlock(pinId, memberId, idempotencyKey);

        // 권한·크레딧 처리 커밋 이후 매 요청마다 현재 블러 영상 키로 새 Presigned GET URL을 발급한다.
        String videoUrl = createDownloadUrl(result.blurredVideoKey());

        return new PinUnlockResponse(
                result.pinId(),
                result.creditCharged(),
                result.creditBalance(),
                videoUrl,
                true);
    }

    /**
     * 반영 트랜잭션을 실행한다. 동시 유니크 충돌은 롤백 이후 별도 트랜잭션 재조회로 확정하고,
     * 그 외 예상치 못한 실패는 PIN_UNLOCK_FAILED로 매핑한다(검증 예외는 그대로 전파).
     */
    private PinUnlockPersistenceService.Result applyUnlock(UUID pinId, Long memberId, UUID idempotencyKey) {
        try {
            return pinUnlockPersistenceService.apply(pinId, memberId, idempotencyKey);
        } catch (PinUnlockPersistenceService.ConcurrentUnlockException e) {
            // 서로 다른 키의 동시 동일-핀 구매 → 앞선 트랜잭션은 롤백됨. 기존 권한을 재조회해 확정한다.
            return reconcileUnlock(pinId, memberId, idempotencyKey);
        } catch (CustomException e) {
            throw e;
        } catch (Exception e) {
            log.error("핀 잠금 해제 반영 실패 (pinId={}, memberId={})", pinId, memberId, e);
            throw new CustomException(ErrorCode.PIN_UNLOCK_FAILED);
        }
    }

    private PinUnlockPersistenceService.Result reconcileUnlock(UUID pinId, Long memberId, UUID idempotencyKey) {
        try {
            return pinUnlockPersistenceService.reconcileExisting(pinId, memberId, idempotencyKey);
        } catch (CustomException e) {
            throw e;
        } catch (Exception e) {
            log.error("핀 잠금 해제 동시성 재조회 실패 (pinId={}, memberId={})", pinId, memberId, e);
            throw new CustomException(ErrorCode.PIN_UNLOCK_FAILED);
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
     * {@code Idempotency-Key} 헤더를 UUID로 파싱한다.
     * 누락이면 IDEMPOTENCY_KEY_REQUIRED, UUID 형식이 아니면 INVALID_IDEMPOTENCY_KEY.
     */
    private UUID parseIdempotencyKey(String rawIdempotencyKey) {
        if (rawIdempotencyKey == null || rawIdempotencyKey.isBlank()) {
            throw new CustomException(ErrorCode.IDEMPOTENCY_KEY_REQUIRED);
        }
        try {
            return UUID.fromString(rawIdempotencyKey.trim());
        } catch (IllegalArgumentException e) {
            throw new CustomException(ErrorCode.INVALID_IDEMPOTENCY_KEY);
        }
    }

    /**
     * 현재 블러 영상 키로 열람용 Presigned GET URL을 발급한다.
     * 권한은 이미 확정(커밋)됐으므로, 발급 실패는 권한을 유지한 채 VIDEO_URL_ISSUE_FAILED로 매핑한다.
     */
    private String createDownloadUrl(String blurredVideoKey) {
        if (blurredVideoKey == null || blurredVideoKey.isBlank()) {
            log.error("잠금 해제 대상 핀의 블러 영상 키가 비어 있습니다.");
            throw new CustomException(ErrorCode.VIDEO_URL_ISSUE_FAILED);
        }
        try {
            return s3PresignedUrlGenerator.createDownloadUrl(blurredVideoKey);
        } catch (Exception e) {
            log.error("잠금 해제 영상 Presigned GET URL 발급 실패", e);
            throw new CustomException(ErrorCode.VIDEO_URL_ISSUE_FAILED);
        }
    }
}
