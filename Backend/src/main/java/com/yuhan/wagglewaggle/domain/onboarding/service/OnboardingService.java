package com.yuhan.wagglewaggle.domain.onboarding.service;

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
import com.yuhan.wagglewaggle.domain.user.entity.AgeGroup;
import com.yuhan.wagglewaggle.domain.user.entity.Gender;
import com.yuhan.wagglewaggle.domain.user.entity.Member;
import com.yuhan.wagglewaggle.domain.user.repository.MemberRepository;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * 온보딩 완료 처리. 온보딩 토큰/세션 검증 → 회원 생성 → 소셜 계정 연결 →
 * 선호 카테고리 저장 → 초기 크레딧 지급 → jti 소비 → Access/Refresh 발급을 하나의 트랜잭션으로 처리한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OnboardingService {

    private static final String BEARER_PREFIX = "Bearer ";
    private static final Pattern NICKNAME_PATTERN = Pattern.compile("^[0-9A-Za-z가-힣]{2,12}$");
    private static final int MAX_PREFERRED_CATEGORIES = 3;

    private final OnboardingSessionRepository onboardingSessionRepository;
    private final SocialAccountRepository socialAccountRepository;
    private final MemberRepository memberRepository;
    private final CategoryRepository categoryRepository;
    private final CategoryPreferenceRepository categoryPreferenceRepository;
    private final CreditTransactionRepository creditTransactionRepository;
    private final RefreshTokenService refreshTokenService;
    private final JwtProvider jwtProvider;

    @Transactional
    public OnboardingResponse complete(String authorizationHeader, OnboardingRequest request) {
        try {
            // 1. 온보딩 토큰 검증
            Claims claims = parseOnboardingToken(extractBearerToken(authorizationHeader));
            UUID jti = extractJti(claims);
            Long claimSocialAccountId = claims.get(JwtProvider.CLAIM_SOCIAL_ACCOUNT_ID, Long.class);

            // 2. 세션 조회(행 잠금) 및 상태 검증
            Instant now = Instant.now();
            OnboardingSession session = onboardingSessionRepository.findByJtiForUpdate(jti)
                    .orElseThrow(() -> new CustomException(ErrorCode.INVALID_ONBOARDING_TOKEN));
            if (session.isUsed()) {
                throw new CustomException(ErrorCode.ONBOARDING_TOKEN_ALREADY_USED);
            }
            if (session.isExpired(now)) {
                throw new CustomException(ErrorCode.INVALID_ONBOARDING_TOKEN);
            }
            if (claimSocialAccountId != null
                    && !claimSocialAccountId.equals(session.getSocialAccountId())) {
                throw new CustomException(ErrorCode.INVALID_ONBOARDING_TOKEN);
            }

            // 3. 소셜 계정 조회 및 온보딩 완료 여부 검증
            SocialAccount socialAccount = socialAccountRepository.findById(session.getSocialAccountId())
                    .orElseThrow(() -> new CustomException(ErrorCode.INVALID_ONBOARDING_TOKEN));
            if (socialAccount.getMember() != null) {
                throw new CustomException(ErrorCode.ONBOARDING_ALREADY_COMPLETED);
            }

            // 4. 요청 값 검증
            if (request == null) {
                throw new CustomException(ErrorCode.INVALID_ONBOARDING_REQUEST);
            }
            String nickname = normalizeAndValidateNickname(request.nickname());
            AgeGroup ageGroup = AgeGroup.from(request.ageGroup());
            Gender gender = Gender.from(request.gender());
            List<Category> categories = resolveCategories(request.preferredCategories());

            // 5. 닉네임 중복 선제 검사
            if (memberRepository.existsByNickname(nickname)) {
                throw new CustomException(ErrorCode.NICKNAME_ALREADY_EXISTS);
            }

            // 6. 회원 생성 (동시 선점 시 유니크 제약 위반 → NICKNAME_ALREADY_EXISTS)
            Member member = Member.create(nickname, ageGroup, gender);
            try {
                memberRepository.saveAndFlush(member);
            } catch (DataIntegrityViolationException e) {
                throw new CustomException(ErrorCode.NICKNAME_ALREADY_EXISTS);
            }

            // 7. 소셜 계정 연결
            socialAccount.linkMember(member);

            // 8. 선호 카테고리 저장
            List<CategoryPreference> preferences = categories.stream()
                    .map(category -> CategoryPreference.create(member.getId(), category.getId()))
                    .toList();
            categoryPreferenceRepository.saveAll(preferences);

            // 9. 초기 크레딧 지급 거래 (기본값 10을 재가산하지 않고 그대로 기록)
            creditTransactionRepository.save(CreditTransaction.create(
                    member.getId(),
                    CreditTransactionType.WELCOME_BONUS,
                    null,
                    Member.INITIAL_CREDIT_BALANCE,
                    Member.INITIAL_CREDIT_BALANCE));

            // 10. jti 사용 완료 처리 (성공 트랜잭션 커밋 시에만 반영)
            session.markUsed(now);

            // 11. Access/Refresh 토큰 발급 및 해시 저장
            String accessToken = jwtProvider.createAccessToken(member.getId());
            String refreshToken = jwtProvider.createRefreshToken(member.getId());
            refreshTokenService.save(
                    member.getId(),
                    RefreshTokenService.hash(refreshToken),
                    now.plusSeconds(jwtProvider.getRefreshTokenExpirationSeconds()));

            return new OnboardingResponse(
                    member.getId(),
                    member.getViewAngle(),
                    member.getCreditBalance(),
                    true,
                    accessToken,
                    refreshToken);
        } catch (CustomException e) {
            throw e;
        } catch (Exception e) {
            log.error("온보딩 처리 실패: {}", e.getMessage());
            throw new CustomException(ErrorCode.ONBOARDING_FAILED);
        }
    }

    private String extractBearerToken(String authorizationHeader) {
        if (authorizationHeader == null || !authorizationHeader.startsWith(BEARER_PREFIX)) {
            throw new CustomException(ErrorCode.INVALID_ONBOARDING_TOKEN);
        }
        String token = authorizationHeader.substring(BEARER_PREFIX.length()).trim();
        if (token.isEmpty()) {
            throw new CustomException(ErrorCode.INVALID_ONBOARDING_TOKEN);
        }
        return token;
    }

    private Claims parseOnboardingToken(String token) {
        try {
            Claims claims = jwtProvider.parse(token);
            if (jwtProvider.getPurpose(claims) != TokenPurpose.ONBOARDING) {
                throw new CustomException(ErrorCode.INVALID_ONBOARDING_TOKEN);
            }
            return claims;
        } catch (CustomException e) {
            throw e;
        } catch (Exception e) {
            throw new CustomException(ErrorCode.INVALID_ONBOARDING_TOKEN);
        }
    }

    private UUID extractJti(Claims claims) {
        String jti = claims.getId();
        if (jti == null) {
            throw new CustomException(ErrorCode.INVALID_ONBOARDING_TOKEN);
        }
        try {
            return UUID.fromString(jti);
        } catch (IllegalArgumentException e) {
            throw new CustomException(ErrorCode.INVALID_ONBOARDING_TOKEN);
        }
    }

    private String normalizeAndValidateNickname(String nickname) {
        if (nickname == null || !NICKNAME_PATTERN.matcher(nickname).matches()) {
            throw new CustomException(ErrorCode.INVALID_ONBOARDING_REQUEST);
        }
        // 영문은 소문자로 정규화한 값으로 중복 검사·저장한다.
        return nickname.toLowerCase(Locale.ROOT);
    }

    private List<Category> resolveCategories(List<String> codes) {
        if (codes == null || codes.isEmpty() || codes.size() > MAX_PREFERRED_CATEGORIES) {
            throw new CustomException(ErrorCode.INVALID_ONBOARDING_REQUEST);
        }
        Set<String> distinctCodes = new LinkedHashSet<>(codes);
        if (distinctCodes.size() != codes.size()) {
            throw new CustomException(ErrorCode.INVALID_ONBOARDING_REQUEST);
        }
        List<Category> categories = categoryRepository.findByCodeIn(distinctCodes);
        if (categories.size() != distinctCodes.size()) {
            throw new CustomException(ErrorCode.INVALID_ONBOARDING_REQUEST);
        }
        return categories;
    }
}
