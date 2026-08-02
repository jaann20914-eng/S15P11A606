package com.yuhan.wagglewaggle.domain.pin.dto;

/**
 * 현재 사용자의 핀 영상 접근 수준.
 *
 * <ul>
 *   <li>{@code OWNER} — 현재 사용자가 핀 작성자.</li>
 *   <li>{@code UNLOCKED} — 작성자가 아니며 해당 핀의 결제 완료(PinUnlock 존재) 열람 권한을 가짐.</li>
 *   <li>{@code PREVIEW_BLURRED} — 그 외(작성자 아님·미구매). 블러 미리보기만 가능.</li>
 * </ul>
 *
 * 작성자 판정을 구매 여부보다 우선한다(작성자에게 PinUnlock이 있어도 OWNER).
 */
public enum VideoAccessLevel {
    OWNER,
    UNLOCKED,
    PREVIEW_BLURRED
}
