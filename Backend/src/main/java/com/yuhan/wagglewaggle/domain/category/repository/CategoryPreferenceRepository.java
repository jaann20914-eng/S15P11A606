package com.yuhan.wagglewaggle.domain.category.repository;

import com.yuhan.wagglewaggle.domain.category.entity.CategoryPreference;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface CategoryPreferenceRepository extends JpaRepository<CategoryPreference, Long> {

    /**
     * 회원의 선호 카테고리 code 목록을 조회한다(추천 요청의 preferredCategories 구성용).
     * category_preferences는 category_id(raw FK)만 저장하므로 categories와 조인해 code를 얻는다.
     * 온보딩에서 최대 3개까지 저장되며, code는 AI CategoryCode(예: CAFE)와 동일한 값이다.
     */
    @Query("""
            SELECT c.code FROM CategoryPreference cp
            JOIN Category c ON c.id = cp.categoryId
            WHERE cp.memberId = :memberId
            """)
    List<String> findPreferredCategoryCodes(@Param("memberId") Long memberId);
}
