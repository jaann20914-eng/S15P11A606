package com.yuhan.wagglewaggle.domain.recommendation.dto;

import java.util.UUID;

/**
 * 추천 카드의 핀 미리보기 항목.
 * uploaderViewAngle은 작성자의 뷰 신뢰도(Member.viewAngle)로 0~360 범위의 각도 값이다.
 */
public record PinPreview(
        UUID pinId,
        double uploaderViewAngle
) {
}
