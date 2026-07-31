package com.yuhan.wagglewaggle.global.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 핀 등록 정책 설정.
 * dailyLimit: 회원 1인의 하루 핀 등록 허용 개수. 정책값이 아직 확정되지 않아 기본 0(=미적용)으로 둔다.
 *             0 이하이면 일일 제한을 적용하지 않으며, 양수로 설정하면 그 값을 상한으로 강제한다.
 */
@ConfigurationProperties(prefix = "pin.registration")
public record PinRegistrationProperties(
        int dailyLimit
) {
}
