package com.yuhan.wagglewaggle.domain.pin.dto;

/**
 * 현재 사용자 기준의 핀 접근·상호작용 정보(내부 결과 모델).
 *
 * @param videoAccess      영상 접근 수준(OWNER / UNLOCKED / PREVIEW_BLURRED)
 * @param isEvaluated      평가 여부. {@code videoAccess=UNLOCKED}일 때만 true/false이며,
 *                         OWNER·PREVIEW_BLURRED에서는 {@code null}
 * @param chatRequestState 현재 사용자와 해당 핀 사이의 채팅 요청/채팅방 상태
 * @param canRequestChat   현재 사용자가 채팅을 요청할 수 있는지 여부
 */
public record PinViewerAccess(
        VideoAccessLevel videoAccess,
        Boolean isEvaluated,
        ChatRequestState chatRequestState,
        boolean canRequestChat
) {
}
