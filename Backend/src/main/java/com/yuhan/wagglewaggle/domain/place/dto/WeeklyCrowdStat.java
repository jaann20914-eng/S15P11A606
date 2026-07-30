package com.yuhan.wagglewaggle.domain.place.dto;

/**
 * 요일별 혼잡 통계 항목. dayOfWeek 는 MON~SUN 코드, averageCrowdLevel 은 집계 데이터가 없으면 null 이다.
 */
public record WeeklyCrowdStat(
        String dayOfWeek,
        Double averageCrowdLevel
) {
}
