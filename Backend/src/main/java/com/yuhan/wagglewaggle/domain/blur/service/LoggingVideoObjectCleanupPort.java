package com.yuhan.wagglewaggle.domain.blur.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * {@link VideoObjectCleanupPort}의 임시 구현.
 *
 * <p>삭제 대상 등록/삭제 기능이 아직 없으므로 등록 대상 키만 로깅하고 실제 삭제는 하지 않는다.
 * 삭제 기능이 준비되면 이 구현을 교체한다(경계는 유지).</p>
 */
@Slf4j
@Component
public class LoggingVideoObjectCleanupPort implements VideoObjectCleanupPort {

    @Override
    public void registerForDeletion(String objectKey) {
        if (objectKey == null || objectKey.isBlank()) {
            return;
        }
        log.info("영상 객체 삭제 대상 등록 (key={}). 삭제 기능 미구현으로 등록만 로깅한다.", objectKey);
    }
}
