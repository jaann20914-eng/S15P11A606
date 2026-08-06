package com.yuhan.wagglewaggle.domain.category.service;

import com.yuhan.wagglewaggle.domain.category.dto.CategoryPreferenceResponse;
import com.yuhan.wagglewaggle.domain.category.dto.CategoryPreferenceUpdateRequest;
import com.yuhan.wagglewaggle.domain.category.entity.Category;
import com.yuhan.wagglewaggle.domain.category.entity.CategoryPreference;
import com.yuhan.wagglewaggle.domain.category.repository.CategoryPreferenceRepository;
import com.yuhan.wagglewaggle.domain.category.repository.CategoryRepository;
import com.yuhan.wagglewaggle.domain.user.entity.AgeGroup;
import com.yuhan.wagglewaggle.domain.user.entity.Gender;
import com.yuhan.wagglewaggle.domain.user.entity.Member;
import com.yuhan.wagglewaggle.domain.user.repository.MemberRepository;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * 관심 카테고리 조회·수정 서비스 단위 테스트.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class CategoryPreferenceServiceTest {

    private static final Long MEMBER_ID = 1L;

    @Mock
    private MemberRepository memberRepository;
    @Mock
    private CategoryRepository categoryRepository;
    @Mock
    private CategoryPreferenceRepository categoryPreferenceRepository;

    @InjectMocks
    private CategoryPreferenceService categoryPreferenceService;

    private Member activeMember() {
        return Member.create("tester", AgeGroup.from("TWENTIES"), Gender.from("MALE"));
    }

    private Category category(Long id, String code) {
        Category category = mock(Category.class);
        given(category.getId()).willReturn(id);
        given(category.getCode()).willReturn(code);
        return category;
    }

    // ---------- getMyCategories ----------

    @Test
    void 관심_카테고리_조회_성공() {
        given(memberRepository.findById(MEMBER_ID)).willReturn(Optional.of(activeMember()));
        given(categoryPreferenceRepository.findPreferredCategoryCodes(MEMBER_ID))
                .willReturn(List.of("CAFE", "PARK"));

        CategoryPreferenceResponse response = categoryPreferenceService.getMyCategories(MEMBER_ID);

        assertThat(response.preferredCategories()).containsExactly("CAFE", "PARK");
    }

    @Test
    void 조회_시_회원이_없으면_USER_NOT_FOUND() {
        given(memberRepository.findById(MEMBER_ID)).willReturn(Optional.empty());

        assertThatThrownBy(() -> categoryPreferenceService.getMyCategories(MEMBER_ID))
                .isInstanceOf(CustomException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.USER_NOT_FOUND);
    }

    // ---------- updateMyCategories ----------

    @Test
    void 관심_카테고리_수정_성공_전체교체() {
        CategoryPreferenceUpdateRequest request = new CategoryPreferenceUpdateRequest(List.of("CAFE", "PARK"));
        List<Category> found = List.of(category(10L, "CAFE"), category(20L, "PARK"));
        given(categoryRepository.findByCodeIn(any())).willReturn(found);
        given(memberRepository.findById(MEMBER_ID)).willReturn(Optional.of(activeMember()));
        given(categoryPreferenceRepository.findPreferredCategoryCodes(MEMBER_ID))
                .willReturn(List.of("CAFE", "PARK"));

        CategoryPreferenceResponse response = categoryPreferenceService.updateMyCategories(MEMBER_ID, request);

        // 기존 선호를 먼저 삭제하고 새 선호를 저장한다.
        verify(categoryPreferenceRepository).deleteByMemberId(MEMBER_ID);
        verify(categoryPreferenceRepository).saveAll(any());
        assertThat(response.preferredCategories()).containsExactly("CAFE", "PARK");
    }

    @Test
    void 수정_요청이_null이면_INVALID_CATEGORY_PREFERENCE() {
        assertThatThrownBy(() -> categoryPreferenceService.updateMyCategories(MEMBER_ID, null))
                .isInstanceOf(CustomException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.INVALID_CATEGORY_PREFERENCE);

        verify(categoryPreferenceRepository, never()).deleteByMemberId(anyLong());
    }

    @Test
    void 수정_카테고리가_비어있으면_INVALID_CATEGORY_PREFERENCE() {
        CategoryPreferenceUpdateRequest request = new CategoryPreferenceUpdateRequest(List.of());

        assertThatThrownBy(() -> categoryPreferenceService.updateMyCategories(MEMBER_ID, request))
                .isInstanceOf(CustomException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.INVALID_CATEGORY_PREFERENCE);

        verify(categoryPreferenceRepository, never()).deleteByMemberId(anyLong());
    }

    @Test
    void 수정_카테고리가_3개를_초과하면_INVALID_CATEGORY_PREFERENCE() {
        CategoryPreferenceUpdateRequest request =
                new CategoryPreferenceUpdateRequest(List.of("CAFE", "PARK", "RESTAURANT", "SHOPPING_MALL"));

        assertThatThrownBy(() -> categoryPreferenceService.updateMyCategories(MEMBER_ID, request))
                .isInstanceOf(CustomException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.INVALID_CATEGORY_PREFERENCE);
    }

    @Test
    void 수정_카테고리에_중복이_있으면_INVALID_CATEGORY_PREFERENCE() {
        CategoryPreferenceUpdateRequest request = new CategoryPreferenceUpdateRequest(List.of("CAFE", "CAFE"));

        assertThatThrownBy(() -> categoryPreferenceService.updateMyCategories(MEMBER_ID, request))
                .isInstanceOf(CustomException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.INVALID_CATEGORY_PREFERENCE);
    }

    @Test
    void 존재하지_않는_카테고리_code면_INVALID_CATEGORY_PREFERENCE() {
        CategoryPreferenceUpdateRequest request = new CategoryPreferenceUpdateRequest(List.of("CAFE", "UNKNOWN"));
        // 2개 요청했으나 1개만 조회됨 → 존재하지 않는 code 포함
        List<Category> found = List.of(category(10L, "CAFE"));
        given(categoryRepository.findByCodeIn(any())).willReturn(found);

        assertThatThrownBy(() -> categoryPreferenceService.updateMyCategories(MEMBER_ID, request))
                .isInstanceOf(CustomException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.INVALID_CATEGORY_PREFERENCE);

        verify(categoryPreferenceRepository, never()).deleteByMemberId(anyLong());
    }

    @Test
    void 수정_시_회원이_없으면_USER_NOT_FOUND() {
        CategoryPreferenceUpdateRequest request = new CategoryPreferenceUpdateRequest(List.of("CAFE"));
        List<Category> found = List.of(category(10L, "CAFE"));
        given(categoryRepository.findByCodeIn(any())).willReturn(found);
        given(memberRepository.findById(MEMBER_ID)).willReturn(Optional.empty());

        assertThatThrownBy(() -> categoryPreferenceService.updateMyCategories(MEMBER_ID, request))
                .isInstanceOf(CustomException.class)
                .hasFieldOrPropertyWithValue("errorCode", ErrorCode.USER_NOT_FOUND);

        verify(categoryPreferenceRepository, never()).deleteByMemberId(anyLong());
    }
}
