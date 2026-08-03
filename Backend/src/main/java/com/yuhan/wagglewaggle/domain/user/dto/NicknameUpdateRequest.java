package com.yuhan.wagglewaggle.domain.user.dto;

/**
 * 닉네임 수정 요청.
 *
 * <p>검증(형식·길이·금칙어·중복)은 서비스 계층에서 정확한 오류 코드로 통일 처리하므로
 * Bean Validation 애노테이션을 두지 않는다. 앞뒤 공백은 자동 제거하지 않고 원문 그대로 검증한다.
 *
 * @param nickname 변경할 닉네임(공백 없이 2~12자 한글·영문·숫자)
 */
public record NicknameUpdateRequest(String nickname) {
}
