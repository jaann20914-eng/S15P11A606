package com.yuhan.wagglewaggle.domain.pin.repository;

import java.time.LocalDate;

/**
 * 서비스 날짜별 영상핀 개수 native 쿼리 결과 프로젝션(월간 활동 히트맵용).
 * serviceDate는 정상 등록 완료 시점(expiresAt-1h)을 Asia/Seoul·04시 경계로 변환한 서비스 날짜다.
 */
public interface DailyPinCountRow {

    LocalDate getServiceDate(); // 서비스 날짜(YYYY-MM-DD)

    long getVideoPinCount(); // 해당 서비스 날짜에 정상 등록 완료된 ACTIVE 영상핀 수
}
