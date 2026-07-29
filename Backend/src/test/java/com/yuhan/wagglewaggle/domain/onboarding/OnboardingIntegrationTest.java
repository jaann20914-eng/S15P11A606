package com.yuhan.wagglewaggle.domain.onboarding;

import com.yuhan.wagglewaggle.domain.auth.entity.OAuthProvider;
import com.yuhan.wagglewaggle.domain.auth.entity.SocialAccount;
import com.yuhan.wagglewaggle.domain.auth.jwt.JwtProvider;
import com.yuhan.wagglewaggle.domain.auth.repository.RefreshTokenRepository;
import com.yuhan.wagglewaggle.domain.auth.repository.SocialAccountRepository;
import com.yuhan.wagglewaggle.domain.auth.service.RefreshTokenService;
import com.yuhan.wagglewaggle.domain.category.repository.CategoryPreferenceRepository;
import com.yuhan.wagglewaggle.domain.credit.entity.CreditTransaction;
import com.yuhan.wagglewaggle.domain.credit.entity.CreditTransactionType;
import com.yuhan.wagglewaggle.domain.credit.repository.CreditTransactionRepository;
import com.yuhan.wagglewaggle.domain.onboarding.dto.OnboardingRequest;
import com.yuhan.wagglewaggle.domain.onboarding.dto.OnboardingResponse;
import com.yuhan.wagglewaggle.domain.onboarding.entity.OnboardingSession;
import com.yuhan.wagglewaggle.domain.onboarding.repository.OnboardingSessionRepository;
import com.yuhan.wagglewaggle.domain.onboarding.service.OnboardingService;
import com.yuhan.wagglewaggle.domain.user.entity.AgeGroup;
import com.yuhan.wagglewaggle.domain.user.entity.Gender;
import com.yuhan.wagglewaggle.domain.user.entity.Member;
import com.yuhan.wagglewaggle.domain.user.repository.MemberRepository;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.elasticsearch.ElasticsearchContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Testcontainers
@ActiveProfiles("test")
class OnboardingIntegrationTest {

    // 실제 Flyway 마이그레이션과 유니크 제약을 검증하기 위한 일회용 Postgres 컨테이너.
    @Container
    static PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16");

    // @SpringBootTest 전체 컨텍스트가 기동 시 ES 인덱스를 초기화하므로 ES 컨테이너도 함께 띄운다.
    @Container
    static ElasticsearchContainer ES = new ElasticsearchContainer(
            "docker.elastic.co/elasticsearch/elasticsearch:9.2.8")
            .withEnv("xpack.security.enabled", "false");

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("spring.elasticsearch.uris", ES::getHttpHostAddress);
    }

    @Autowired OnboardingService onboardingService;
    @Autowired JwtProvider jwtProvider;
    @Autowired MemberRepository memberRepository;
    @Autowired SocialAccountRepository socialAccountRepository;
    @Autowired OnboardingSessionRepository onboardingSessionRepository;
    @Autowired CategoryPreferenceRepository categoryPreferenceRepository;
    @Autowired CreditTransactionRepository creditTransactionRepository;
    @Autowired RefreshTokenRepository refreshTokenRepository;
    @Autowired JdbcTemplate jdbcTemplate;

    @BeforeEach
    void cleanUp() {
        // categories는 Flyway 시드를 유지하고, 온보딩으로 생성되는 가변 데이터만 초기화한다.
        jdbcTemplate.execute("TRUNCATE members, social_accounts, onboarding_sessions, refresh_tokens, "
                + "category_preferences, credit_transactions RESTART IDENTITY CASCADE");
    }

    private record Fixture(Long socialAccountId, UUID jti, String authorizationHeader) {}

    private Fixture prepareOnboarding(String providerUserId) {
        SocialAccount socialAccount = socialAccountRepository.save(
                SocialAccount.create(OAuthProvider.KAKAO, providerUserId, providerUserId + "@kakao.com"));
        UUID jti = UUID.randomUUID();
        onboardingSessionRepository.save(
                OnboardingSession.create(jti, socialAccount.getId(), Instant.now().plusSeconds(600)));
        String token = jwtProvider.createOnboardingToken(socialAccount.getId(), OAuthProvider.KAKAO, jti.toString());
        return new Fixture(socialAccount.getId(), jti, "Bearer " + token);
    }

    private static OnboardingRequest request(String nickname, List<String> categories) {
        return new OnboardingRequest("TWENTIES", "FEMALE", nickname, categories);
    }

    @Test
    void 정상_온보딩이면_회원_카테고리_크레딧_세션_토큰이_모두_반영된다() {
        Fixture fixture = prepareOnboarding("uid-normal");

        OnboardingResponse response = onboardingService.complete(
                fixture.authorizationHeader(), request("Waggler", List.of("CAFE", "RESTAURANT")));

        // 응답
        assertThat(response.onboardingCompleted()).isTrue();
        assertThat(response.viewAngle()).isEqualTo(90);
        assertThat(response.creditBalance()).isEqualTo(10);
        assertThat(response.accessToken()).isNotBlank();
        assertThat(response.refreshToken()).isNotBlank();

        // 회원(닉네임 소문자 정규화)
        Member member = memberRepository.findById(response.memberId()).orElseThrow();
        assertThat(member.getNickname()).isEqualTo("waggler");
        assertThat(member.getAgeGroup()).isEqualTo(AgeGroup.TWENTIES);
        assertThat(member.getGender()).isEqualTo(Gender.FEMALE);
        assertThat(member.getViewAngle()).isEqualTo(90);
        assertThat(member.getCreditBalance()).isEqualTo(10);

        // 소셜 계정 연결
        SocialAccount linked = socialAccountRepository.findById(fixture.socialAccountId()).orElseThrow();
        assertThat(linked.getMember()).isNotNull();
        assertThat(linked.getMember().getId()).isEqualTo(response.memberId());

        // 선호 카테고리 2건
        assertThat(categoryPreferenceRepository.findAll()).hasSize(2);

        // 크레딧 거래 정확히 1건, WELCOME_BONUS +10 / 잔액 10
        List<CreditTransaction> transactions = creditTransactionRepository.findAll();
        assertThat(transactions).hasSize(1);
        CreditTransaction tx = transactions.get(0);
        assertThat(tx.getType()).isEqualTo(CreditTransactionType.WELCOME_BONUS);
        assertThat(tx.getChangeAmount()).isEqualTo(10);
        assertThat(tx.getBalanceAfter()).isEqualTo(10);

        // 세션 사용 처리
        OnboardingSession session = onboardingSessionRepository.findById(fixture.jti()).orElseThrow();
        assertThat(session.isUsed()).isTrue();

        // 리프레시 토큰 해시 저장(원문 아님)
        assertThat(refreshTokenRepository.findByTokenHash(RefreshTokenService.hash(response.refreshToken())))
                .isPresent();
    }

    @Test
    void 대소문자만_다른_닉네임은_중복으로_처리된다() {
        memberRepository.save(Member.create("waggler", AgeGroup.TEENS, Gender.MALE));
        Fixture fixture = prepareOnboarding("uid-dup");

        assertThatCustomException(
                () -> onboardingService.complete(fixture.authorizationHeader(), request("WAGGLER", List.of("CAFE"))),
                ErrorCode.NICKNAME_ALREADY_EXISTS);
    }

    @Test
    void 이미_회원과_연결된_소셜계정이면_ONBOARDING_ALREADY_COMPLETED() {
        Fixture fixture = prepareOnboarding("uid-completed");
        Member member = memberRepository.save(Member.create("existing", AgeGroup.THIRTIES, Gender.MALE));
        SocialAccount socialAccount = socialAccountRepository.findById(fixture.socialAccountId()).orElseThrow();
        socialAccount.linkMember(member);
        socialAccountRepository.save(socialAccount);

        assertThatCustomException(
                () -> onboardingService.complete(fixture.authorizationHeader(), request("newnick", List.of("CAFE"))),
                ErrorCode.ONBOARDING_ALREADY_COMPLETED);
    }

    @Test
    void 이미_사용된_토큰이면_ONBOARDING_TOKEN_ALREADY_USED() {
        Fixture fixture = prepareOnboarding("uid-reused");
        onboardingService.complete(fixture.authorizationHeader(), request("firstuse", List.of("CAFE")));

        assertThatCustomException(
                () -> onboardingService.complete(fixture.authorizationHeader(), request("seconduse", List.of("CAFE"))),
                ErrorCode.ONBOARDING_TOKEN_ALREADY_USED);
    }

    @Test
    void 닉네임_중복으로_실패하면_전체_롤백되고_세션은_소비되지_않는다() {
        memberRepository.save(Member.create("dupnick", AgeGroup.TEENS, Gender.MALE));
        long memberCountBefore = memberRepository.count();
        Fixture fixture = prepareOnboarding("uid-rollback");

        assertThatCustomException(
                () -> onboardingService.complete(fixture.authorizationHeader(), request("DUPNICK", List.of("CAFE"))),
                ErrorCode.NICKNAME_ALREADY_EXISTS);

        assertThat(memberRepository.count()).isEqualTo(memberCountBefore); // 새 회원 미생성
        assertThat(categoryPreferenceRepository.count()).isZero();
        assertThat(creditTransactionRepository.count()).isZero();
        assertThat(onboardingSessionRepository.findById(fixture.jti()).orElseThrow().isUsed()).isFalse();
    }

    @Test
    void 동일_닉네임_동시_요청이면_하나만_성공하고_하나는_NICKNAME_ALREADY_EXISTS() throws Exception {
        Fixture f1 = prepareOnboarding("uid-race-a");
        Fixture f2 = prepareOnboarding("uid-race-b");

        List<ErrorCode> outcomes = runConcurrently(
                () -> call(f1.authorizationHeader(), request("racenick", List.of("CAFE"))),
                () -> call(f2.authorizationHeader(), request("racenick", List.of("CAFE"))));

        assertThat(outcomes).filteredOn(code -> code == null).hasSize(1); // 성공 1건
        assertThat(outcomes).contains(ErrorCode.NICKNAME_ALREADY_EXISTS);
    }

    @Test
    void 동일_토큰_동시_요청이면_하나만_성공하고_하나는_ONBOARDING_TOKEN_ALREADY_USED() throws Exception {
        Fixture fixture = prepareOnboarding("uid-race-token");

        List<ErrorCode> outcomes = runConcurrently(
                () -> call(fixture.authorizationHeader(), request("tokraceone", List.of("CAFE"))),
                () -> call(fixture.authorizationHeader(), request("tokracetwo", List.of("CAFE"))));

        assertThat(outcomes).filteredOn(code -> code == null).hasSize(1); // 성공 1건
        assertThat(outcomes).contains(ErrorCode.ONBOARDING_TOKEN_ALREADY_USED);
    }

    // 성공이면 null, 실패면 ErrorCode 를 돌려주는 단일 온보딩 호출.
    private ErrorCode call(String header, OnboardingRequest request) {
        try {
            onboardingService.complete(header, request);
            return null;
        } catch (CustomException e) {
            return e.getErrorCode();
        }
    }

    private List<ErrorCode> runConcurrently(Callable<ErrorCode> task1, Callable<ErrorCode> task2) throws Exception {
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            CountDownLatch ready = new CountDownLatch(2);
            CountDownLatch start = new CountDownLatch(1);
            Callable<ErrorCode> gated1 = gate(task1, ready, start);
            Callable<ErrorCode> gated2 = gate(task2, ready, start);
            Future<ErrorCode> f1 = pool.submit(gated1);
            Future<ErrorCode> f2 = pool.submit(gated2);
            ready.await();
            start.countDown();
            return List.of(safeGet(f1), safeGet(f2));
        } finally {
            pool.shutdownNow();
        }
    }

    private Callable<ErrorCode> gate(Callable<ErrorCode> task, CountDownLatch ready, CountDownLatch start) {
        return () -> {
            ready.countDown();
            start.await();
            return task.call();
        };
    }

    private ErrorCode safeGet(Future<ErrorCode> future) throws Exception {
        try {
            return future.get();
        } catch (java.util.concurrent.ExecutionException e) {
            if (e.getCause() instanceof CustomException ce) {
                return ce.getErrorCode();
            }
            throw e;
        }
    }

    private void assertThatCustomException(Runnable runnable, ErrorCode expected) {
        try {
            runnable.run();
            org.junit.jupiter.api.Assertions.fail("CustomException(" + expected + ") 가 발생해야 합니다.");
        } catch (CustomException e) {
            assertThat(e.getErrorCode()).isEqualTo(expected);
        }
    }
}
