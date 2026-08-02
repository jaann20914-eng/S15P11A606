package com.yuhan.wagglewaggle.domain.pin.service;

import com.yuhan.wagglewaggle.domain.blur.service.VideoObjectCleanupPort;
import com.yuhan.wagglewaggle.domain.pin.dto.PinDeleteResponse;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.UUID;

/**
 * 핀 삭제(DELETE /api/v1/pins/{pinId}) 애플리케이션 서비스.
 *
 * <p>pinId 형식 검증 → 반영 트랜잭션({@link PinDeletePersistenceService}) → 커밋 이후
 * 스토리지 정리 대상 등록 순으로 오케스트레이션한다. 정리 대상 등록은 트랜잭션 밖에서 수행해,
 * 스토리지 물리 삭제 실패가 소프트 삭제 트랜잭션을 롤백시키지 않도록 분리한다.</p>
 *
 * <p>검증 예외(CustomException: INVALID_PIN_ID·PIN_NOT_FOUND·PIN_DELETE_FORBIDDEN)는 그대로 전파하고,
 * 예상치 못한 저장 실패는 롤백 후 PIN_DELETE_FAILED(500)로 매핑한다.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PinDeleteService {

    private final PinDeletePersistenceService pinDeletePersistenceService;
    private final VideoObjectCleanupPort videoObjectCleanupPort;

    public PinDeleteResponse delete(Long memberId, String rawPinId) {
        UUID pinId = parsePinId(rawPinId);

        PinDeletePersistenceService.Result result;
        try {
            result = pinDeletePersistenceService.apply(pinId, memberId);
        } catch (CustomException e) {
            throw e;
        } catch (Exception e) {
            log.error("핀 삭제 반영 실패 (pinId={}, memberId={})", pinId, memberId, e);
            throw new CustomException(ErrorCode.PIN_DELETE_FAILED);
        }

        // 커밋 이후 스토리지 정리 대상 등록(등록과 실제 삭제 분리). 실패해도 삭제 결과에 영향을 주지 않는다.
        for (String key : result.cleanupKeys()) {
            try {
                videoObjectCleanupPort.registerForDeletion(key);
            } catch (Exception e) {
                log.error("삭제 대상 객체 등록 실패 (pinId={}, key={})", pinId, key, e);
            }
        }

        return PinDeleteResponse.of(pinId, result.closedChatRoomIds(), result.deletedAt());
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
}
