package com.yuhan.wagglewaggle.domain.user.repository;

import com.yuhan.wagglewaggle.domain.credit.entity.CreditTransaction;
import com.yuhan.wagglewaggle.domain.credit.entity.CreditTransactionType;
import com.yuhan.wagglewaggle.domain.credit.repository.CreditTransactionRepository;
import com.yuhan.wagglewaggle.domain.pin.entity.CrowdLevel;
import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import com.yuhan.wagglewaggle.domain.pin.entity.PinEvaluation;
import com.yuhan.wagglewaggle.domain.pin.entity.PinEvaluationType;
import com.yuhan.wagglewaggle.domain.pin.entity.VideoStatus;
import com.yuhan.wagglewaggle.domain.pin.repository.DailyPinCountRow;
import com.yuhan.wagglewaggle.domain.pin.repository.PinEvaluationRepository;
import com.yuhan.wagglewaggle.domain.pin.repository.PinRepository;
import com.yuhan.wagglewaggle.domain.place.entity.Place;
import com.yuhan.wagglewaggle.domain.user.entity.AgeGroup;
import com.yuhan.wagglewaggle.domain.user.entity.Gender;
import com.yuhan.wagglewaggle.domain.user.entity.Member;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.util.ReflectionTestUtils;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 내 프로필·활동 요약 집계 native 쿼리를 실제 PostgreSQL 위에서 검증한다.
 * 서비스 날짜 경계(Asia/Seoul 04시)와 핀 정상 등록 완료 시점(expiresAt-1h) 변환, 상태·작성자·부호 필터가
 * SQL에서 정확히 동작하는지 확인한다.
 */
@DataJpaTest
@ActiveProfiles("test")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers
class UserProfileAggregationRepositoryJpaTest {

    @Container
    @SuppressWarnings("resource")
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>(
            DockerImageName.parse("postgis/postgis:16-3.4").asCompatibleSubstituteFor("postgres"));

    @DynamicPropertySource
    static void datasourceProps(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
    }

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final GeometryFactory GF = new GeometryFactory(new PrecisionModel(), 4326);

    private static final LocalDate JULY_START = LocalDate.of(2026, 7, 1);
    private static final LocalDate AUGUST_START = LocalDate.of(2026, 8, 1);

    @Autowired private TestEntityManager em;
    @Autowired private PinRepository pinRepository;
    @Autowired private CreditTransactionRepository creditTransactionRepository;
    @Autowired private PinEvaluationRepository pinEvaluationRepository;

    @Test
    @DisplayName("월간 영상핀 집계는 정상 등록 완료 시점을 04시 경계 서비스 날짜로 변환하고 상태·작성자로 필터한다")
    void dailyActiveVideoPinCounts_serviceDateBoundaryAndFilters() {
        Member author = persistMember("author");
        Member other = persistMember("other");
        Place place = persistPlace();

        // 완료 KST 04:00(2026-07-15) → 서비스 날짜 07-15
        persistPin(author, place, VideoStatus.ACTIVE, false, kst(2026, 7, 15, 4, 0));
        // 완료 KST 03:59(2026-07-15) → 경계 이전이라 서비스 날짜 07-14
        persistPin(author, place, VideoStatus.ACTIVE, false, kst(2026, 7, 15, 3, 59));
        // 완료 KST 10:00(2026-07-16) → 서비스 날짜 07-16
        persistPin(author, place, VideoStatus.ACTIVE, false, kst(2026, 7, 16, 10, 0));
        // 제외 대상들
        persistPin(author, place, VideoStatus.PENDING, false, null); // 미완료(expiresAt null)
        persistPin(author, place, VideoStatus.REJECTED, false, kst(2026, 7, 17, 12, 0));
        persistPin(author, place, VideoStatus.ACTIVE, true, kst(2026, 7, 18, 12, 0)); // 소프트 삭제
        persistPin(author, place, VideoStatus.ACTIVE, false, kst(2026, 6, 20, 12, 0)); // 6월(월 밖)
        persistPin(other, place, VideoStatus.ACTIVE, false, kst(2026, 7, 15, 12, 0)); // 타인 핀

        em.flush();
        em.clear();

        Map<LocalDate, Long> counts = pinRepository
                .findDailyActiveVideoPinCounts(author.getId(), JULY_START, AUGUST_START)
                .stream()
                .collect(Collectors.toMap(DailyPinCountRow::getServiceDate, DailyPinCountRow::getVideoPinCount));

        assertThat(counts).containsOnly(
                Map.entry(LocalDate.of(2026, 7, 14), 1L),
                Map.entry(LocalDate.of(2026, 7, 15), 1L),
                Map.entry(LocalDate.of(2026, 7, 16), 1L));

        // 오늘(서비스 날짜) 카운트: 07-15에는 1건
        assertThat(pinRepository.countActiveVideoPinsByServiceDate(author.getId(), LocalDate.of(2026, 7, 15)))
                .isEqualTo(1L);
        assertThat(pinRepository.countActiveVideoPinsByServiceDate(author.getId(), LocalDate.of(2026, 7, 20)))
                .isZero();
    }

    @Test
    @DisplayName("월 적립 크레딧은 04시 경계로 변환한 서비스 날짜의 양수 거래만 합산한다")
    void sumEarnedCredit_positiveOnlyWithinServiceMonth() {
        Member member = persistMember("earner");
        Member other = persistMember("other");

        persistCredit(member, 10, kst(2026, 7, 10, 12, 0)); // 07-10 → 포함
        persistCredit(member, 3, kst(2026, 7, 15, 4, 0));   // 07-15 → 포함
        persistCredit(member, -3, kst(2026, 7, 15, 12, 0)); // 음수(회수/차감) → 제외
        persistCredit(member, 7, kst(2026, 7, 1, 3, 0));    // 07-01 03:00 → 서비스 날짜 06-30 → 제외
        persistCredit(member, 5, kst(2026, 6, 30, 12, 0));  // 6월 → 제외
        persistCredit(other, 100, kst(2026, 7, 12, 12, 0)); // 타인 → 제외

        em.flush();
        em.clear();

        assertThat(creditTransactionRepository
                .sumEarnedCreditByServiceMonth(member.getId(), JULY_START, AUGUST_START))
                .isEqualTo(13L);
    }

    @Test
    @DisplayName("월 HELPFUL 평가 수는 본인 핀에 대한 타인의 HELPFUL만, 서비스 날짜 기준으로 센다")
    void countHelpful_othersHelpfulOnOwnPinsWithinServiceMonth() {
        Member author = persistMember("author");
        Member e1 = persistMember("e1");
        Member e2 = persistMember("e2");
        Member e3 = persistMember("e3");
        Member e4 = persistMember("e4");
        Place place = persistPlace();

        Pin myPin = persistPin(author, place, VideoStatus.ACTIVE, false, kst(2026, 7, 1, 12, 0));
        Pin othersPin = persistPin(e1, place, VideoStatus.ACTIVE, false, kst(2026, 7, 1, 12, 0));

        persistEvaluation(myPin, e1, PinEvaluationType.HELPFUL, kst(2026, 7, 10, 12, 0));   // 포함
        persistEvaluation(myPin, e2, PinEvaluationType.HELPFUL, kst(2026, 7, 20, 12, 0));   // 포함
        persistEvaluation(myPin, e3, PinEvaluationType.NOT_HELPFUL, kst(2026, 7, 11, 12, 0)); // NOT_HELPFUL 제외
        persistEvaluation(myPin, author, PinEvaluationType.HELPFUL, kst(2026, 7, 12, 12, 0)); // 본인 평가 제외
        persistEvaluation(myPin, e4, PinEvaluationType.HELPFUL, kst(2026, 6, 30, 12, 0));   // 6월 제외
        persistEvaluation(othersPin, e2, PinEvaluationType.HELPFUL, kst(2026, 7, 13, 12, 0)); // 타인 핀 제외

        em.flush();
        em.clear();

        assertThat(pinEvaluationRepository
                .countHelpfulEvaluationsByServiceMonth(author.getId(), JULY_START, AUGUST_START))
                .isEqualTo(2L);
    }

    // ===== helpers =====

    private static Instant kst(int year, int month, int day, int hour, int minute) {
        return LocalDateTime.of(year, month, day, hour, minute, 0).atZone(KST).toInstant();
    }

    private Member persistMember(String nickname) {
        return em.persist(Member.create(nickname, AgeGroup.TWENTIES, Gender.FEMALE));
    }

    private Place persistPlace() {
        return em.persist(Place.create("kakao-1", "테스트 카페", GF.createPoint(new Coordinate(127.03, 37.5))));
    }

    /** completionKst(정상 등록 완료 시점)로부터 expiresAt = 완료 + 1h 를 설정한 핀을 저장한다. */
    private Pin persistPin(Member member, Place place, VideoStatus status, boolean deleted, Instant completionKst) {
        Pin pin = Pin.create(
                member, place, CrowdLevel.WAGLE,
                GF.createPoint(new Coordinate(127.0, 37.5)),
                "2층 창가", "조용해요", "pins/original/1/" + UUID.randomUUID() + ".mp4", null);
        ReflectionTestUtils.setField(pin, "videoStatus", status);
        if (completionKst != null) {
            ReflectionTestUtils.setField(pin, "expiresAt", completionKst.plus(Duration.ofHours(1)));
        }
        if (deleted) {
            ReflectionTestUtils.setField(pin, "deletedAt", Instant.now());
        }
        return em.persist(pin);
    }

    private void persistCredit(Member member, int changeAmount, Instant createdAt) {
        int balanceAfter = Math.max(changeAmount, 0) + 100;
        CreditTransaction tx = CreditTransaction.create(
                member.getId(), CreditTransactionType.PIN_EVALUATION_PARTICIPATED, null, changeAmount, balanceAfter);
        em.persist(tx);
        // JPA Auditing이 persist 시점에 created_at을 현재 시각으로 채우므로,
        // 원하는 서비스 날짜로 검증하기 위해 저장 후 값을 덮어쓴다(@CreatedDate는 갱신 시 다시 변경되지 않는다).
        setCreatedAt(tx, createdAt);
    }

    private void persistEvaluation(Pin pin, Member evaluator, PinEvaluationType type, Instant createdAt) {
        PinEvaluation evaluation = PinEvaluation.create(pin, evaluator, type);
        em.persist(evaluation);
        setCreatedAt(evaluation, createdAt);
    }

    /** 저장 이후 created_at을 원하는 시각으로 설정하고 flush하여 UPDATE로 반영한다. */
    private void setCreatedAt(Object entity, Instant createdAt) {
        ReflectionTestUtils.setField(entity, "createdAt", createdAt);
        em.flush();
    }
}
