package com.yuhan.wagglewaggle.domain.onboarding.service;

import com.yuhan.wagglewaggle.domain.auth.entity.OAuthProvider;
import com.yuhan.wagglewaggle.domain.auth.entity.SocialAccount;
import com.yuhan.wagglewaggle.domain.auth.jwt.JwtProvider;
import com.yuhan.wagglewaggle.domain.auth.jwt.TokenPurpose;
import com.yuhan.wagglewaggle.domain.auth.repository.SocialAccountRepository;
import com.yuhan.wagglewaggle.domain.auth.service.RefreshTokenService;
import com.yuhan.wagglewaggle.domain.category.entity.Category;
import com.yuhan.wagglewaggle.domain.category.entity.CategoryPreference;
import com.yuhan.wagglewaggle.domain.category.repository.CategoryPreferenceRepository;
import com.yuhan.wagglewaggle.domain.category.repository.CategoryRepository;
import com.yuhan.wagglewaggle.domain.credit.entity.CreditTransaction;
import com.yuhan.wagglewaggle.domain.credit.entity.CreditTransactionType;
import com.yuhan.wagglewaggle.domain.credit.repository.CreditTransactionRepository;
import com.yuhan.wagglewaggle.domain.onboarding.dto.OnboardingRequest;
import com.yuhan.wagglewaggle.domain.onboarding.dto.OnboardingResponse;
import com.yuhan.wagglewaggle.domain.onboarding.entity.OnboardingSession;
import com.yuhan.wagglewaggle.domain.onboarding.repository.OnboardingSessionRepository;
import com.yuhan.wagglewaggle.domain.user.entity.Member;
import com.yuhan.wagglewaggle.domain.user.repository.MemberRepository;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import io.jsonwebtoken.Claims;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class OnboardingServiceTest {

    @Mock private OnboardingSessionRepository onboardingSessionRepository;
    @Mock private SocialAccountRepository socialAccountRepository;
    @Mock private MemberRepository memberRepository;
    @Mock private CategoryRepository categoryRepository;
    @Mock private CategoryPreferenceRepository categoryPreferenceRepository;
    @Mock private CreditTransactionRepository creditTransactionRepository;
    @Mock private RefreshTokenService refreshTokenService;
    @Mock private JwtProvider jwtProvider;

    @InjectMocks private OnboardingService onboardingService;

    private static final String HEADER = "Bearer good-token";
    private static final UUID JTI = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final Long SOCIAL_ACCOUNT_ID = 10L;

    private OnboardingSession session;
    private SocialAccount socialAccount;

    private static OnboardingRequest request(String ageGroup, String gender, String nickname, List<String> categories) {
        return new OnboardingRequest(ageGroup, gender, nickname, categories);
    }

    private static OnboardingRequest validRequest() {
        return request("TWENTIES", "FEMALE", "와글러", List.of("CAFE", "RESTAURANT"));
    }

    @BeforeEach
    void setUp() {
        Claims claims = mock(Claims.class);
        given(jwtProvider.parse("good-token")).willReturn(claims);
        given(jwtProvider.getPurpose(claims)).willReturn(TokenPurpose.ONBOARDING);
        given(claims.getId()).willReturn(JTI.toString());
        given(claims.get(JwtProvider.CLAIM_SOCIAL_ACCOUNT_ID, Long.class)).willReturn(SOCIAL_ACCOUNT_ID);

        session = OnboardingSession.create(JTI, SOCIAL_ACCOUNT_ID, Instant.now().plusSeconds(600));
        given(onboardingSessionRepository.findByJtiForUpdate(JTI)).willReturn(Optional.of(session));

        socialAccount = SocialAccount.create(OAuthProvider.KAKAO, "kakao-uid", "user@kakao.com");
        given(socialAccountRepository.findById(SOCIAL_ACCOUNT_ID)).willReturn(Optional.of(socialAccount));

        // 요청한 코드 개수만큼 카테고리를 돌려주어 개수 검증을 통과시킨다(미지원 코드 테스트는 개별 override).
        given(categoryRepository.findByCodeIn(any())).willAnswer(invocation -> {
            java.util.Collection<String> codes = invocation.getArgument(0);
            java.util.List<Category> result = new java.util.ArrayList<>();
            if (codes == null) {
                return result;
            }
            long id = 1;
            for (String ignored : codes) {
                result.add(category(id++));
            }
            return result;
        });
        given(memberRepository.existsByNickname(anyString())).willReturn(false);
        given(memberRepository.saveAndFlush(any(Member.class))).willAnswer(inv -> {
            Member m = inv.getArgument(0);
            ReflectionTestUtils.setField(m, "id", 1L);
            return m;
        });

        given(jwtProvider.createAccessToken(1L)).willReturn("access-jwt");
        given(jwtProvider.createRefreshToken(1L)).willReturn("refresh-raw");
        given(jwtProvider.getRefreshTokenExpirationSeconds()).willReturn(1209600L);
    }

    private static Category category(Long id) {
        Category category = mock(Category.class);
        given(category.getId()).willReturn(id);
        return category;
    }

    // ===== 정상 =====

    @Test
    void 정상_온보딩이면_201_데이터와_초기값을_반환한다() {
        OnboardingResponse response = onboardingService.complete(HEADER, validRequest());

        assertThat(response.memberId()).isEqualTo(1L);
        assertThat(response.viewAngle()).isEqualByComparingTo(java.math.BigDecimal.valueOf(90));
        assertThat(response.creditBalance()).isEqualTo(10);
        assertThat(response.onboardingCompleted()).isTrue();
        assertThat(response.accessToken()).isEqualTo("access-jwt");
        assertThat(response.refreshToken()).isEqualTo("refresh-raw");
        assertThat(socialAccount.getMember()).isNotNull();
        assertThat(session.isUsed()).isTrue();
    }

    @Test
    void 영문_닉네임은_소문자로_정규화되어_저장된다() {
        onboardingService.complete(HEADER, request("TWENTIES", "MALE", "WaGGle", List.of("CAFE")));

        ArgumentCaptor<Member> captor = ArgumentCaptor.forClass(Member.class);
        org.mockito.Mockito.verify(memberRepository).saveAndFlush(captor.capture());
        assertThat(captor.getValue().getNickname()).isEqualTo("waggle");
    }

    @Test
    void 초기_크레딧_거래는_WELCOME_BONUS_10_잔액10_한건_생성된다() {
        onboardingService.complete(HEADER, validRequest());

        ArgumentCaptor<CreditTransaction> captor = ArgumentCaptor.forClass(CreditTransaction.class);
        org.mockito.Mockito.verify(creditTransactionRepository).save(captor.capture());
        CreditTransaction tx = captor.getValue();
        assertThat(tx.getType()).isEqualTo(CreditTransactionType.WELCOME_BONUS);
        assertThat(tx.getChangeAmount()).isEqualTo(10);
        assertThat(tx.getBalanceAfter()).isEqualTo(10);
    }

    @Test
    void 선호_카테고리는_요청_개수만큼_저장된다() {
        onboardingService.complete(HEADER, validRequest());

        ArgumentCaptor<List<CategoryPreference>> captor = ArgumentCaptor.forClass(List.class);
        org.mockito.Mockito.verify(categoryPreferenceRepository).saveAll(captor.capture());
        assertThat(captor.getValue()).hasSize(2);
    }

    // ===== 토큰/세션 =====

    @Test
    void 토큰_헤더가_없으면_INVALID_ONBOARDING_TOKEN() {
        assertError(() -> onboardingService.complete(null, validRequest()), ErrorCode.INVALID_ONBOARDING_TOKEN);
    }

    @Test
    void Bearer_형식이_아니면_INVALID_ONBOARDING_TOKEN() {
        assertError(() -> onboardingService.complete("good-token", validRequest()), ErrorCode.INVALID_ONBOARDING_TOKEN);
    }

    @Test
    void 서명검증_실패면_INVALID_ONBOARDING_TOKEN() {
        given(jwtProvider.parse("good-token")).willThrow(new RuntimeException("서명 오류"));
        assertError(() -> onboardingService.complete(HEADER, validRequest()), ErrorCode.INVALID_ONBOARDING_TOKEN);
    }

    @Test
    void purpose가_ONBOARDING이_아니면_INVALID_ONBOARDING_TOKEN() {
        Claims claims = mock(Claims.class);
        given(jwtProvider.parse("good-token")).willReturn(claims);
        given(jwtProvider.getPurpose(claims)).willReturn(TokenPurpose.ACCESS);
        assertError(() -> onboardingService.complete(HEADER, validRequest()), ErrorCode.INVALID_ONBOARDING_TOKEN);
    }

    @Test
    void 세션이_없으면_INVALID_ONBOARDING_TOKEN() {
        given(onboardingSessionRepository.findByJtiForUpdate(JTI)).willReturn(Optional.empty());
        assertError(() -> onboardingService.complete(HEADER, validRequest()), ErrorCode.INVALID_ONBOARDING_TOKEN);
    }

    @Test
    void 이미_사용된_세션이면_ONBOARDING_TOKEN_ALREADY_USED() {
        session.markUsed(Instant.now());
        assertError(() -> onboardingService.complete(HEADER, validRequest()), ErrorCode.ONBOARDING_TOKEN_ALREADY_USED);
    }

    @Test
    void 만료된_세션이면_INVALID_ONBOARDING_TOKEN() {
        OnboardingSession expired = OnboardingSession.create(JTI, SOCIAL_ACCOUNT_ID, Instant.now().minusSeconds(1));
        given(onboardingSessionRepository.findByJtiForUpdate(JTI)).willReturn(Optional.of(expired));
        assertError(() -> onboardingService.complete(HEADER, validRequest()), ErrorCode.INVALID_ONBOARDING_TOKEN);
    }

    @Test
    void social_account_id_claim이_세션과_다르면_INVALID_ONBOARDING_TOKEN() {
        Claims claims = mock(Claims.class);
        given(jwtProvider.parse("good-token")).willReturn(claims);
        given(jwtProvider.getPurpose(claims)).willReturn(TokenPurpose.ONBOARDING);
        given(claims.getId()).willReturn(JTI.toString());
        given(claims.get(JwtProvider.CLAIM_SOCIAL_ACCOUNT_ID, Long.class)).willReturn(999L);
        assertError(() -> onboardingService.complete(HEADER, validRequest()), ErrorCode.INVALID_ONBOARDING_TOKEN);
    }

    @Test
    void 이미_회원과_연결된_소셜계정이면_ONBOARDING_ALREADY_COMPLETED() {
        socialAccount.linkMember(mock(Member.class));
        assertError(() -> onboardingService.complete(HEADER, validRequest()), ErrorCode.ONBOARDING_ALREADY_COMPLETED);
    }

    // ===== 입력 검증 =====

    @Test
    void 잘못된_ageGroup이면_INVALID_ONBOARDING_REQUEST() {
        assertError(() -> onboardingService.complete(HEADER, request("TEEN", "MALE", "와글러", List.of("CAFE"))),
                ErrorCode.INVALID_ONBOARDING_REQUEST);
    }

    @Test
    void 잘못된_gender면_INVALID_ONBOARDING_REQUEST() {
        assertError(() -> onboardingService.complete(HEADER, request("TWENTIES", "X", "와글러", List.of("CAFE"))),
                ErrorCode.INVALID_ONBOARDING_REQUEST);
    }

    @Test
    void 카테고리가_0개면_INVALID_ONBOARDING_REQUEST() {
        assertError(() -> onboardingService.complete(HEADER, request("TWENTIES", "MALE", "와글러", List.of())),
                ErrorCode.INVALID_ONBOARDING_REQUEST);
    }

    @Test
    void 카테고리가_4개면_INVALID_ONBOARDING_REQUEST() {
        assertError(() -> onboardingService.complete(HEADER,
                        request("TWENTIES", "MALE", "와글러", List.of("CAFE", "RESTAURANT", "PARK", "SHOPPING_MALL"))),
                ErrorCode.INVALID_ONBOARDING_REQUEST);
    }

    @Test
    void 중복_카테고리면_INVALID_ONBOARDING_REQUEST() {
        assertError(() -> onboardingService.complete(HEADER, request("TWENTIES", "MALE", "와글러", List.of("CAFE", "CAFE"))),
                ErrorCode.INVALID_ONBOARDING_REQUEST);
    }

    @Test
    void 미지원_카테고리_코드면_INVALID_ONBOARDING_REQUEST() {
        List<Category> onlyOne = List.of(category(1L)); // 요청 2개 중 1개만 존재
        given(categoryRepository.findByCodeIn(any())).willReturn(onlyOne);
        assertError(() -> onboardingService.complete(HEADER, request("TWENTIES", "MALE", "와글러", List.of("CAFE", "NOPE"))),
                ErrorCode.INVALID_ONBOARDING_REQUEST);
    }

    @Test
    void 닉네임_형식_오류면_INVALID_ONBOARDING_REQUEST() {
        assertError(() -> onboardingService.complete(HEADER, request("TWENTIES", "MALE", "a", List.of("CAFE"))),
                ErrorCode.INVALID_ONBOARDING_REQUEST);
        assertError(() -> onboardingService.complete(HEADER, request("TWENTIES", "MALE", "공백 닉", List.of("CAFE"))),
                ErrorCode.INVALID_ONBOARDING_REQUEST);
        assertError(() -> onboardingService.complete(HEADER, request("TWENTIES", "MALE", "닉!!", List.of("CAFE"))),
                ErrorCode.INVALID_ONBOARDING_REQUEST);
    }

    // ===== 닉네임 중복 =====

    @Test
    void 닉네임이_이미_존재하면_NICKNAME_ALREADY_EXISTS() {
        given(memberRepository.existsByNickname("와글러")).willReturn(true);
        assertError(() -> onboardingService.complete(HEADER, validRequest()), ErrorCode.NICKNAME_ALREADY_EXISTS);
    }

    @Test
    void 저장시_유니크_제약_위반이면_NICKNAME_ALREADY_EXISTS() {
        given(memberRepository.saveAndFlush(any(Member.class)))
                .willThrow(new DataIntegrityViolationException("uq_member_nickname"));
        assertError(() -> onboardingService.complete(HEADER, validRequest()), ErrorCode.NICKNAME_ALREADY_EXISTS);
    }

    // ===== 예기치 못한 오류 =====

    @Test
    void 예기치_못한_예외면_ONBOARDING_FAILED() {
        given(creditTransactionRepository.save(any())).willThrow(new RuntimeException("DB 오류"));
        assertError(() -> onboardingService.complete(HEADER, validRequest()), ErrorCode.ONBOARDING_FAILED);
    }

    private void assertError(Runnable runnable, ErrorCode expected) {
        assertThatThrownBy(runnable::run)
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(expected);
    }
}
