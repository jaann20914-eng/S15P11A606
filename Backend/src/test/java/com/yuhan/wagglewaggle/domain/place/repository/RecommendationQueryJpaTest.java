package com.yuhan.wagglewaggle.domain.place.repository;

import com.yuhan.wagglewaggle.domain.category.entity.Category;
import com.yuhan.wagglewaggle.domain.category.entity.CategoryPreference;
import com.yuhan.wagglewaggle.domain.category.repository.CategoryPreferenceRepository;
import com.yuhan.wagglewaggle.domain.category.repository.CategoryRepository;
import com.yuhan.wagglewaggle.domain.pin.entity.CrowdLevel;
import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import com.yuhan.wagglewaggle.domain.pin.entity.VideoStatus;
import com.yuhan.wagglewaggle.domain.pin.repository.PinRepository;
import com.yuhan.wagglewaggle.domain.place.entity.Place;
import com.yuhan.wagglewaggle.domain.place.entity.PlaceCategory;
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
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 추천 후보 조회·집계에 쓰이는 쿼리들을 실제 PostGIS(PostgreSQL) 위에서 검증한다.
 * - PlaceRepository.findCandidatePlaceIds: 반경(ST_DWithin) + 카테고리(ETC 제외) + 활성 핀 존재
 * - PinRepository.findActivePinsByPlaceIdIn: 표준 활성 조건 + 활성화 시각 내림차순 정렬
 * - CategoryPreferenceRepository.findPreferredCategoryCodes: 선호 카테고리 code 조인 조회
 */
@DataJpaTest
@ActiveProfiles("test")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers
class RecommendationQueryJpaTest {

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

    private static final GeometryFactory GF = new GeometryFactory(new PrecisionModel(), 4326);

    // 기준 위치(성수 인근, 스펙 예시 좌표)
    private static final double BASE_LAT = 37.5006;
    private static final double BASE_LNG = 127.0364;
    private static final double RADIUS_METERS = 1000.0;

    @Autowired private TestEntityManager em;
    @Autowired private PlaceRepository placeRepository;
    @Autowired private PinRepository pinRepository;
    @Autowired private CategoryRepository categoryRepository;
    @Autowired private CategoryPreferenceRepository categoryPreferenceRepository;

    @Test
    @DisplayName("반경 1km 내 · 카테고리 ETC 아님 · 활성 핀 보유 장소만 후보로 조회된다")
    void findCandidatePlaceIds_filtersByRadiusCategoryAndActivePin() {
        Member author = em.persist(Member.create("author", AgeGroup.TWENTIES, Gender.FEMALE));

        // A: 반경 내 CAFE + 활성 핀 → 후보
        Place near = persistPlace("near", PlaceCategory.CAFE, BASE_LAT, BASE_LNG);
        persistPin(author, near, VideoStatus.ACTIVE, futureExpiry(), false);

        // B: 반경 밖(~2.2km) CAFE + 활성 핀 → 제외
        Place far = persistPlace("far", PlaceCategory.CAFE, BASE_LAT + 0.02, BASE_LNG);
        persistPin(author, far, VideoStatus.ACTIVE, futureExpiry(), false);

        // C: 반경 내 ETC + 활성 핀 → 제외
        Place etc = persistPlace("etc", PlaceCategory.ETC, BASE_LAT + 0.001, BASE_LNG);
        persistPin(author, etc, VideoStatus.ACTIVE, futureExpiry(), false);

        // D: 반경 내 CAFE 이지만 활성 핀 없음(PENDING) → 제외
        Place noActive = persistPlace("noActive", PlaceCategory.CAFE, BASE_LAT + 0.001, BASE_LNG + 0.001);
        persistPin(author, noActive, VideoStatus.PENDING, null, false);

        flushAndClear();

        List<Long> candidates = placeRepository.findCandidatePlaceIds(
                BASE_LNG, BASE_LAT, RADIUS_METERS, Instant.now());

        assertThat(candidates).containsExactly(near.getId());
    }

    @Test
    @DisplayName("표준 활성 조건(ACTIVE·미삭제·미만료)만 조회하고 활성화 시각 내림차순으로 정렬한다")
    void findActivePinsByPlaceIdIn_returnsOnlyActiveOrderedByExpiryDesc() {
        Member author = em.persist(Member.create("author", AgeGroup.TWENTIES, Gender.FEMALE));
        Place place = persistPlace("place", PlaceCategory.CAFE, BASE_LAT, BASE_LNG);

        Pin older = persistPin(author, place, VideoStatus.ACTIVE, Instant.now().plus(Duration.ofMinutes(10)), false);
        Pin newer = persistPin(author, place, VideoStatus.ACTIVE, Instant.now().plus(Duration.ofMinutes(50)), false);
        // 제외 대상들
        persistPin(author, place, VideoStatus.ACTIVE, Instant.now().minus(Duration.ofMinutes(1)), false); // 만료
        persistPin(author, place, VideoStatus.PENDING, null, false);                                       // 비활성
        persistPin(author, place, VideoStatus.ACTIVE, futureExpiry(), true);                               // 삭제

        flushAndClear();

        List<Pin> pins = pinRepository.findActivePinsByPlaceIdIn(List.of(place.getId()), Instant.now());

        // 활성 2건만, expiresAt(=활성화시각+1h) 내림차순 → newer 먼저
        assertThat(pins).extracting(Pin::getId).containsExactly(newer.getId(), older.getId());
        // member fetch join 확인
        assertThat(pins.get(0).getMember().getNickname()).isEqualTo("author");
    }

    @Test
    @DisplayName("선호 카테고리 code를 조인으로 조회한다")
    void findPreferredCategoryCodes_returnsCodes() {
        Member member = em.persist(Member.create("member", AgeGroup.THIRTIES, Gender.MALE));
        // categories 는 V2 마이그레이션 시드로 존재한다.
        Category cafe = categoryRepository.findByCodeIn(List.of("CAFE")).get(0);
        Category park = categoryRepository.findByCodeIn(List.of("PARK")).get(0);
        em.persist(CategoryPreference.create(member.getId(), cafe.getId()));
        em.persist(CategoryPreference.create(member.getId(), park.getId()));
        flushAndClear();

        List<String> codes = categoryPreferenceRepository.findPreferredCategoryCodes(member.getId());

        assertThat(codes).containsExactlyInAnyOrder("CAFE", "PARK");
    }

    private Place persistPlace(String name, PlaceCategory category, double lat, double lng) {
        Point point = GF.createPoint(new Coordinate(lng, lat));
        return em.persist(Place.create(
                "kakao-" + name, name, point, category, null, null, null, "", ""));
    }

    private Pin persistPin(Member member, Place place, VideoStatus status, Instant expiresAt, boolean deleted) {
        Pin pin = Pin.create(
                member, place, CrowdLevel.WAGLE,
                GF.createPoint(new Coordinate(place.getLocation().getX(), place.getLocation().getY())),
                "2층 창가", "메모", uniqueKey(), null);
        ReflectionTestUtils.setField(pin, "videoStatus", status);
        ReflectionTestUtils.setField(pin, "expiresAt", expiresAt);
        if (deleted) {
            ReflectionTestUtils.setField(pin, "deletedAt", Instant.now());
        }
        return em.persist(pin);
    }

    private Instant futureExpiry() {
        return Instant.now().plus(Duration.ofMinutes(30));
    }

    private String uniqueKey() {
        return "pins/original/1/" + UUID.randomUUID() + ".mp4";
    }

    private void flushAndClear() {
        em.flush();
        em.clear();
    }
}
