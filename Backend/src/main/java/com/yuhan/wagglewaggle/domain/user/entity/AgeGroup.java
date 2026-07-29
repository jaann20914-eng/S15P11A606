package com.yuhan.wagglewaggle.domain.user.entity;

/**
 * 회원 연령대. 온보딩 요청의 ageGroup 문자열 enum과 1:1 대응한다.
 * 문자열 파싱(from)은 온보딩 검증 단계에서 추가한다.
 */
public enum AgeGroup {
    TEENS,
    TWENTIES,
    THIRTIES,
    FORTIES,
    FIFTIES,
    SIXTIES,
    SEVENTIES_AND_OVER
}
