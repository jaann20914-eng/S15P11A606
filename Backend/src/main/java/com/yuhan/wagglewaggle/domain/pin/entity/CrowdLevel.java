package com.yuhan.wagglewaggle.domain.pin.entity;

/**
 * 현장 혼잡도
 * weight는 평균 혼잡도 계산에 쓰이는 명시적 가중치이다.
 */
public enum CrowdLevel {
    WAGLE_WAGLE(4),
    WAGLE(3),
    RELAXED(2),
    LEISURELY(1);

    private final int weight;

    CrowdLevel(int weight) {
        this.weight = weight;
    }

    public int getWeight() {
        return weight;
    }
}
