package com.yuhan.wagglewaggle.domain.place.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * {@link PlaceScoreRecalculationPort}의 임시 구현.
 *
 * <p>장소 점수 계산 기능이 아직 없으므로 재계산 대상만 로깅하고 실제 계산은 하지 않는다.
 * 점수 기능이 준비되면 이 구현을 교체한다(경계는 유지).</p>
 */
@Slf4j
@Component
public class LoggingPlaceScoreRecalculationPort implements PlaceScoreRecalculationPort {

    @Override
    public void recalculate(Long placeId) {
        log.info("장소 점수 재계산 대상 (placeId={}). 점수 계산 기능 미구현으로 스킵한다.", placeId);
    }
}
