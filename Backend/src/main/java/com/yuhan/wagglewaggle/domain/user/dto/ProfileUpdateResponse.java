package com.yuhan.wagglewaggle.domain.user.dto;

import java.util.List;

/**
 * 마이페이지 '변경 저장' 응답. 수정 후 최종 닉네임과 관심 카테고리를 함께 반환한다.
 *
 * @param nickname            수정된 닉네임
 * @param preferredCategories 수정된 관심 카테고리 code 목록
 */
public record ProfileUpdateResponse(String nickname, List<String> preferredCategories) {
}
