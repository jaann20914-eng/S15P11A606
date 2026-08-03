package com.yuhan.wagglewaggle.domain.pin.repository;

/**
 * 장소별 열람(unlock) 수 집계 프로젝션.
 * 추천 후보 장소의 최근 7일 열람수(unlockCount7d) 산출에 사용한다.
 */
public interface PlaceUnlockCountRow {

    Long getPlaceId();

    long getUnlockCount();
}
