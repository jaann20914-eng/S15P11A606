package com.yuhan.wagglewaggle.domain.user.dto;

/**
 * 서비스 이용 가능 상태. 뷰 신뢰도(view_angle)가 0도인 사용자는 BLOCKED, 그 외에는 ALLOWED다.
 */
public enum ServiceAccess {
    ALLOWED,
    BLOCKED
}
