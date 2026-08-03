package com.yuhan.wagglewaggle.domain.user.dto;

/**
 * 닉네임 수정 응답.
 *
 * @param nickname 소문자 정규화 정책이 적용되어 저장된 최종 닉네임
 */
public record NicknameUpdateResponse(String nickname) {
}
