package com.yuhan.wagglewaggle.domain.category.dto;

import java.util.List;

/**
 * 관심 카테고리 수정 요청.
 *
 * <p>검증(개수 1~3개·중복·존재하는 code 여부)은 서비스 계층에서 INVALID_CATEGORY_PREFERENCE로
 * 통일 처리하므로 Bean Validation 애노테이션을 두지 않는다.
 *
 * @param preferredCategories 변경할 카테고리 code 목록(예: ["CAFE", "PARK"]). 1~3개, 중복 불가.
 */
public record CategoryPreferenceUpdateRequest(List<String> preferredCategories) {
}
