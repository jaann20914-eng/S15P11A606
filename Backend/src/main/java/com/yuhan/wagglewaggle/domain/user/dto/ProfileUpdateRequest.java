package com.yuhan.wagglewaggle.domain.user.dto;

import java.util.List;

/**
 * 마이페이지 '변경 저장' 요청. 닉네임과 관심 카테고리를 한 번에 수정한다.
 *
 * <p>검증(닉네임 형식·중복, 카테고리 개수·중복·존재 여부)은 서비스 계층에서 정확한 오류 코드로 통일 처리하므로
 * Bean Validation 애노테이션을 두지 않는다.
 *
 * @param nickname            변경할 닉네임(공백 없이 2~12자 한글·영문·숫자)
 * @param preferredCategories 변경할 관심 카테고리 code 목록(예: ["CAFE", "PARK"]). 1~3개, 중복 불가.
 */
public record ProfileUpdateRequest(String nickname, List<String> preferredCategories) {
}
