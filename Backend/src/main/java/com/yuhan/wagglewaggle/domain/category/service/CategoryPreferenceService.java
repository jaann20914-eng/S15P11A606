package com.yuhan.wagglewaggle.domain.category.service;

import com.yuhan.wagglewaggle.domain.category.dto.CategoryPreferenceResponse;
import com.yuhan.wagglewaggle.domain.category.dto.CategoryPreferenceUpdateRequest;
import com.yuhan.wagglewaggle.domain.category.entity.Category;
import com.yuhan.wagglewaggle.domain.category.entity.CategoryPreference;
import com.yuhan.wagglewaggle.domain.category.repository.CategoryPreferenceRepository;
import com.yuhan.wagglewaggle.domain.category.repository.CategoryRepository;
import com.yuhan.wagglewaggle.domain.user.repository.MemberRepository;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * 마이페이지 관심 카테고리 조회·수정 서비스.
 * 저장 형태는 온보딩과 동일한 category_preferences(회원-카테고리 연결)를 사용하며,
 * 수정은 기존 선호를 전부 삭제하고 새로 저장하는 전체 교체(replace-all) 방식이다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CategoryPreferenceService {

    private static final int MAX_PREFERRED_CATEGORIES = 3;

    private final MemberRepository memberRepository;
    private final CategoryRepository categoryRepository;
    private final CategoryPreferenceRepository categoryPreferenceRepository;

    /**
     * 현재 인증 사용자가 선택한 관심 카테고리 code 목록을 조회한다.
     * 설정 화면에서 기존 선택값을 미리 선택된 상태로 표시하는 데 사용한다.
     */
    @Transactional(readOnly = true)
    public CategoryPreferenceResponse getMyCategories(Long memberId) {
        validateMemberExists(memberId);
        try {
            List<String> codes = categoryPreferenceRepository.findPreferredCategoryCodes(memberId);
            return new CategoryPreferenceResponse(codes);
        } catch (CustomException e) {
            throw e;
        } catch (Exception e) {
            log.error("관심 카테고리 조회 실패: {}", e.getMessage());
            throw new CustomException(ErrorCode.CATEGORY_PREFERENCE_FETCH_FAILED);
        }
    }

    /**
     * 현재 인증 사용자의 관심 카테고리를 수정한다.
     * 개수(1~3개)·중복·존재하는 code 여부를 서비스 계층에서 다시 검증하며,
     * 기존 선호를 모두 삭제한 뒤 요청한 카테고리로 새로 저장한다.
     */
    @Transactional
    public CategoryPreferenceResponse updateMyCategories(Long memberId, CategoryPreferenceUpdateRequest request) {
        if (request == null) {
            throw new CustomException(ErrorCode.INVALID_CATEGORY_PREFERENCE);
        }
        List<Category> categories = resolveCategories(request.preferredCategories());
        validateMemberExists(memberId);
        try {
            // 전체 교체: 기존 선호 삭제(벌크) → 새 선호 저장
            categoryPreferenceRepository.deleteByMemberId(memberId);
            List<CategoryPreference> preferences = categories.stream()
                    .map(category -> CategoryPreference.create(memberId, category.getId()))
                    .toList();
            categoryPreferenceRepository.saveAll(preferences);

            // 방금 저장한 카테고리 code를 그대로 반환한다(추가 조회 불필요). 순서에는 의미가 없다.
            List<String> codes = categories.stream().map(Category::getCode).toList();
            return new CategoryPreferenceResponse(codes);
        } catch (CustomException e) {
            throw e;
        } catch (Exception e) {
            log.error("관심 카테고리 수정 실패: {}", e.getMessage());
            throw new CustomException(ErrorCode.CATEGORY_PREFERENCE_UPDATE_FAILED);
        }
    }

    private void validateMemberExists(Long memberId) {
        memberRepository.findById(memberId)
                .filter(m -> m.getDeletedAt() == null)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
    }

    /**
     * 요청 code 목록을 검증하고 Category 엔티티로 변환한다.
     * (온보딩과 동일한 규칙: 1~3개, 중복 불가, 모두 존재하는 code)
     */
    private List<Category> resolveCategories(List<String> codes) {
        if (codes == null || codes.isEmpty() || codes.size() > MAX_PREFERRED_CATEGORIES) {
            throw new CustomException(ErrorCode.INVALID_CATEGORY_PREFERENCE);
        }
        Set<String> distinctCodes = new LinkedHashSet<>(codes);
        if (distinctCodes.size() != codes.size()) {
            throw new CustomException(ErrorCode.INVALID_CATEGORY_PREFERENCE);
        }
        List<Category> categories = categoryRepository.findByCodeIn(distinctCodes);
        if (categories.size() != distinctCodes.size()) {
            throw new CustomException(ErrorCode.INVALID_CATEGORY_PREFERENCE);
        }
        return categories;
    }
}
