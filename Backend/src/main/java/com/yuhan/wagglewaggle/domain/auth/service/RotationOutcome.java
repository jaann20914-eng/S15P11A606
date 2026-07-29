package com.yuhan.wagglewaggle.domain.auth.service;

/**
 * 리프레시 토큰 회전 시도 결과.
 * 비즈니스 결과는 예외 대신 이 값으로 전달해, 재사용 폐기 write가 커밋된 뒤
 * 오케스트레이터(트랜잭션 밖)에서 상황에 맞는 예외를 던지도록 한다.
 */
public enum RotationOutcome {
    ROTATED,
    NOT_FOUND,
    EXPIRED,
    REUSE_DETECTED
}
