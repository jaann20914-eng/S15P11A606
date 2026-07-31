package com.yuhan.wagglewaggle.domain.pin.repository;

/**
 * 요일별 혼잡 통계 native 쿼리 결과 프로젝션.
 */
public interface WeeklyCrowdStatRow {

    Integer getDayOfWeek(); // KST 기준 Postgres EXTRACT(DOW): 0=일요일 ... 6=토요일

    Double getAverageWeight(); // CrowdLevel 가중치(1~4)의 평균
}
