package com.yuhan.wagglewaggle.domain.user.dto;

/**
 * 닉네임 중복 확인 응답.
 *
 * @param nickname  정규화된 요청 닉네임
 * @param available 형식이 유효하고 다른 사용자가 사용하지 않으면 true
 */
public record NicknameAvailabilityResponse(String nickname, boolean available) {
}
