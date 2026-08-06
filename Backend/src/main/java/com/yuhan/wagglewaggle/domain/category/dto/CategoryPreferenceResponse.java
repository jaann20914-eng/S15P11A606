package com.yuhan.wagglewaggle.domain.category.dto;

import java.util.List;

/**
 * 관심 카테고리 조회·수정 응답.
 * 현재 회원이 선택한 카테고리 code 목록을 반환한다(조회·수정 공용).
 *
 * @param preferredCategories 선택된 카테고리 code 목록(예: ["CAFE", "PARK"]).
 */
public record CategoryPreferenceResponse(List<String> preferredCategories) {
}
