package com.yuhan.wagglewaggle.domain.user.service;

import com.yuhan.wagglewaggle.domain.category.repository.CategoryPreferenceRepository;
import com.yuhan.wagglewaggle.domain.category.service.CategoryPreferenceService;
import com.yuhan.wagglewaggle.domain.user.dto.ProfileUpdateResponse;
import com.yuhan.wagglewaggle.domain.user.dto.ProfileUpdateRequest;
import com.yuhan.wagglewaggle.domain.user.entity.AgeGroup;
import com.yuhan.wagglewaggle.domain.user.entity.Gender;
import com.yuhan.wagglewaggle.domain.user.entity.Member;
import com.yuhan.wagglewaggle.domain.user.repository.MemberRepository;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import com.yuhan.wagglewaggle.support.AbstractPostgresContainerTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * PATCH /me(프로필 일괄 수정)의 트랜잭션 원자성을 실제 PostgreSQL 컨테이너로 검증한다.
 * 카테고리 검증이 실패하면 그 전에 flush된 닉네임 변경까지 함께 롤백되어야 한다.
 *
 * <p>롤백은 커밋된 상태를 별도 트랜잭션에서 재조회해야 관측되므로, 각 테스트 메서드는
 * {@code @Transactional(NOT_SUPPORTED)}로 ambient 테스트 트랜잭션을 끄고 서비스/리포지토리가
 * 각자의 트랜잭션으로 실제 커밋·롤백하도록 둔다. 컨테이너는 재사용되므로 생성 데이터는 정리한다.
 * 카테고리 기준 데이터(CAFE, PARK 등)는 Flyway 시드로 이미 존재한다.
 */
@Import({UserService.class, CategoryPreferenceService.class, ForbiddenNicknamePolicy.class})
class ProfileUpdateTransactionJpaTest extends AbstractPostgresContainerTest {

    @Autowired private UserService userService;
    @Autowired private MemberRepository memberRepository;
    @Autowired private CategoryPreferenceRepository categoryPreferenceRepository;
    @Autowired private PlatformTransactionManager transactionManager;

    private TransactionTemplate tx;
    private Long memberId;

    @BeforeEach
    void setUp() {
        tx = new TransactionTemplate(transactionManager);
    }

    @AfterEach
    void cleanUp() {
        if (memberId != null) {
            Long id = memberId;
            tx.executeWithoutResult(status -> {
                categoryPreferenceRepository.deleteByMemberId(id);
                memberRepository.deleteById(id);
            });
            memberId = null;
        }
    }

    /** 닉네임 정책(공백 없이 2~12자 영문·숫자)을 만족하고 재사용 컨테이너에서도 충돌하지 않는 고유 닉네임. */
    private String uniqueNickname(String prefix) {
        return (prefix + Long.toString(System.nanoTime())).substring(0, 11);
    }

    private Long persistMember(String nickname) {
        Member saved = memberRepository.save(Member.create(nickname, AgeGroup.TWENTIES, Gender.MALE));
        return saved.getId();
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @DisplayName("카테고리 검증이 실패하면 같은 트랜잭션의 닉네임 변경도 롤백된다")
    void 카테고리_실패시_닉네임_변경도_롤백() {
        String oldNickname = uniqueNickname("a");
        memberId = persistMember(oldNickname);
        String newNickname = uniqueNickname("b");

        // 빈 카테고리 → 카테고리 검증 단계에서 실패. 그 전에 닉네임은 saveAndFlush로 반영된다.
        assertThatThrownBy(() -> userService.updateProfile(
                memberId, new ProfileUpdateRequest(newNickname, List.of())))
                .isInstanceOf(CustomException.class)
                .extracting(e -> ((CustomException) e).getErrorCode())
                .isEqualTo(ErrorCode.INVALID_CATEGORY_PREFERENCE);

        // 별도 조회: 트랜잭션이 롤백되어 닉네임은 이전 값 그대로, 카테고리는 저장되지 않아야 한다.
        Member reloaded = memberRepository.findById(memberId).orElseThrow();
        assertThat(reloaded.getNickname()).isEqualTo(oldNickname);
        assertThat(categoryPreferenceRepository.findPreferredCategoryCodes(memberId)).isEmpty();
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    @DisplayName("닉네임과 관심 카테고리가 하나의 트랜잭션으로 함께 저장된다")
    void 닉네임과_카테고리_함께_저장() {
        String oldNickname = uniqueNickname("a");
        memberId = persistMember(oldNickname);
        String newNickname = uniqueNickname("b");

        ProfileUpdateResponse response = userService.updateProfile(
                memberId, new ProfileUpdateRequest(newNickname, List.of("CAFE", "PARK")));

        assertThat(response.nickname()).isEqualTo(newNickname);
        assertThat(response.preferredCategories()).containsExactlyInAnyOrder("CAFE", "PARK");

        // 별도 조회로 실제 커밋 상태를 확인한다.
        Member reloaded = memberRepository.findById(memberId).orElseThrow();
        assertThat(reloaded.getNickname()).isEqualTo(newNickname);
        assertThat(categoryPreferenceRepository.findPreferredCategoryCodes(memberId))
                .containsExactlyInAnyOrder("CAFE", "PARK");
    }
}
