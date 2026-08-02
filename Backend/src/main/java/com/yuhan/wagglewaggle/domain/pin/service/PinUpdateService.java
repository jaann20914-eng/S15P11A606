package com.yuhan.wagglewaggle.domain.pin.service;

import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJobStatus;
import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJobType;
import com.yuhan.wagglewaggle.domain.blur.publisher.AiBlurJobPublisher;
import com.yuhan.wagglewaggle.domain.blur.repository.AiBlurJobRepository;
import com.yuhan.wagglewaggle.domain.pin.dto.PinUpdateRequest;
import com.yuhan.wagglewaggle.domain.pin.dto.PinUpdateResponse;
import com.yuhan.wagglewaggle.domain.pin.dto.ValidatedPinUpdate;
import com.yuhan.wagglewaggle.domain.place.service.PlaceScoreRecalculationPort;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 핀 수정(PATCH /api/v1/pins/{pinId}) 애플리케이션 서비스.
 *
 * <p>요청 검증({@link PinUpdateValidator}) → (영상 교체 시) 외부 영상 객체 검증
 * ({@link ReplacementVideoValidator}) → 반영 트랜잭션({@link PinUpdatePersistenceService})
 * → 커밋 이후 RabbitMQ 발행·장소 점수 재계산 순으로 오케스트레이션한다.</p>
 *
 * <p>외부 I/O(S3 HEAD) 검증은 트랜잭션 밖에서 끝내고, DB 변경만 한 트랜잭션으로 처리한다.
 * 저장 실패(예상치 못한 오류)는 롤백 후 PIN_UPDATE_FAILED(500)로 매핑한다.
 * 검증 예외(CustomException)는 그대로 전파한다.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PinUpdateService {

    private final PinUpdateValidator pinUpdateValidator;
    private final ReplacementVideoValidator replacementVideoValidator;
    private final AiBlurJobRepository aiBlurJobRepository;
    private final PinUpdatePersistenceService pinUpdatePersistenceService;
    private final AiBlurJobPublisher aiBlurJobPublisher;
    private final PlaceScoreRecalculationPort placeScoreRecalculationPort;

    public PinUpdateResponse update(Long memberId, String rawPinId, PinUpdateRequest request) {
        // 1. pinId 형식 · Pin 존재/작성자/상태 · 요청 필드 · 최종 장소/좌표/거리 검증
        ValidatedPinUpdate validated = pinUpdateValidator.validate(memberId, rawPinId, request);

        boolean videoReplacement = request != null && request.originalVideoKey().isPresent();
        String replacementVideoKey = null;
        if (videoReplacement) {
            replacementVideoKey = request.originalVideoKey().value();

            // 2. 진행 중 교체 작업 조기 확인(잠금 없는 빠른 실패). 권위 있는 확인은 트랜잭션 내 잠금 하에서 수행한다.
            if (aiBlurJobRepository.existsByPinIdAndJobTypeAndStatus(
                    validated.pinId(), AiBlurJobType.VIDEO_REPLACEMENT, AiBlurJobStatus.PENDING)) {
                throw new CustomException(ErrorCode.PIN_UPDATE_IN_PROGRESS);
            }

            // 3~7. 객체 키 형식·소유 경로·S3 실존·정책·중복 검증(트랜잭션 밖 외부 I/O)
            replacementVideoValidator.validate(memberId, replacementVideoKey);
        }

        // 8. 반영(트랜잭션). 일반 정보 변경 + PinTag 교체 + (교체 시) AiBlurJob PENDING 생성.
        PinUpdatePersistenceService.Result result;
        try {
            result = pinUpdatePersistenceService.apply(validated, replacementVideoKey);
        } catch (CustomException e) {
            throw e;
        } catch (Exception e) {
            log.error("핀 수정 반영 실패 (pinId={}, memberId={})", validated.pinId(), memberId, e);
            throw new CustomException(ErrorCode.PIN_UPDATE_FAILED);
        }

        // 9. 커밋 이후 RabbitMQ 발행(교체 시). 발행 실패는 저장을 롤백하지 않으며 응답에도 영향을 주지 않는다.
        //    (커밋된 PENDING 작업은 재발행 스케줄러가 동일 requestId로 재시도한다.)
        if (result.aiBlurJob() != null) {
            try {
                aiBlurJobPublisher.publish(result.aiBlurJob());
            } catch (Exception e) {
                log.error("ai.blur.request 교체 최초 발행 실패 (requestId={}). 재발행 스케줄러가 재시도한다.",
                        result.aiBlurJob().getRequestId(), e);
            }
        }

        // 10. 커밋 이후 장소 점수 재계산(경계만; 현재 미구현). 실패해도 수정 결과에 영향을 주지 않는다.
        for (Long placeId : result.placeIdsToRecalculate()) {
            try {
                placeScoreRecalculationPort.recalculate(placeId);
            } catch (Exception e) {
                log.error("장소 점수 재계산 실패 (placeId={})", placeId, e);
            }
        }

        if (result.aiBlurJob() != null) {
            return PinUpdateResponse.withReplacement(
                    validated.pinId(), result.videoStatus(), result.updatedFields(),
                    List.of("originalVideoKey"));
        }
        return PinUpdateResponse.generalOnly(
                validated.pinId(), result.videoStatus(), result.updatedFields());
    }
}
