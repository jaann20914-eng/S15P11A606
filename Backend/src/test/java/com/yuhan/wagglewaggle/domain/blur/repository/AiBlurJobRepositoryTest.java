package com.yuhan.wagglewaggle.domain.blur.repository;

import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJob;
import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJobStatus;
import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJobType;
import com.yuhan.wagglewaggle.domain.pin.entity.CrowdLevel;
import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import com.yuhan.wagglewaggle.domain.place.entity.Place;
import com.yuhan.wagglewaggle.domain.user.entity.AgeGroup;
import com.yuhan.wagglewaggle.domain.user.entity.Gender;
import com.yuhan.wagglewaggle.domain.user.entity.Member;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * ai_blur_jobs 저장 구조 통합 테스트.
 * 실제 PostGIS(PostgreSQL) 컨테이너 위에서 Flyway 마이그레이션을 적용해
 * 엔티티 매핑·제약조건(FK, UNIQUE)·재발행 조회를 검증한다.
 */
@DataJpaTest
@ActiveProfiles("test")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers
class AiBlurJobRepositoryTest {

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

    @Autowired private AiBlurJobRepository aiBlurJobRepository;
    @Autowired private TestEntityManager em;

    private UUID pinId;

    @BeforeEach
    void setUp() {
        Member member = em.persist(Member.create("tester", AgeGroup.TWENTIES, Gender.MALE));
        Place place = em.persist(Place.create("kakao-1", "테스트 장소", point(127.03, 37.50)));
        Pin pin = em.persist(Pin.create(
                member, place, CrowdLevel.WAGLE, point(127.03, 37.50),
                "2층 창가", "메모", "videos/original/first.mp4", null));
        em.flush();
        pinId = pin.getId();
    }

    @Test
    @DisplayName("AI 블러 작업을 저장하면 request_id/created_at이 채워지고 상태는 PENDING으로 시작한다")
    void save_populatesGeneratedFields() {
        AiBlurJob job = AiBlurJob.create(pinId, "videos/original/first.mp4", AiBlurJobType.INITIAL_UPLOAD);

        AiBlurJob saved = aiBlurJobRepository.saveAndFlush(job);
        em.clear();

        AiBlurJob found = aiBlurJobRepository.findById(saved.getRequestId()).orElseThrow();
        assertThat(found.getRequestId()).isNotNull();
        assertThat(found.getPinId()).isEqualTo(pinId);
        assertThat(found.getJobType()).isEqualTo(AiBlurJobType.INITIAL_UPLOAD);
        assertThat(found.getStatus()).isEqualTo(AiBlurJobStatus.PENDING);
        assertThat(found.getCreatedAt()).isNotNull();
        assertThat(found.getCompletedAt()).isNull();
    }

    @Test
    @DisplayName("한 핀에 최초 등록·영상 교체 작업을 여러 개 저장할 수 있다(pin_id에 UNIQUE 없음)")
    void multipleJobsPerPin_allowed() {
        aiBlurJobRepository.saveAndFlush(
                AiBlurJob.create(pinId, "videos/original/first.mp4", AiBlurJobType.INITIAL_UPLOAD));
        aiBlurJobRepository.saveAndFlush(
                AiBlurJob.create(pinId, "videos/original/replaced.mp4", AiBlurJobType.VIDEO_REPLACEMENT));

        List<AiBlurJob> jobs = aiBlurJobRepository.findByPinIdOrderByCreatedAtDesc(pinId);
        assertThat(jobs).hasSize(2);
    }

    @Test
    @DisplayName("동일한 original_video_key로는 두 번째 작업을 저장할 수 없다(UNIQUE 제약)")
    void duplicateOriginalVideoKey_rejected() {
        aiBlurJobRepository.saveAndFlush(
                AiBlurJob.create(pinId, "videos/original/dup.mp4", AiBlurJobType.INITIAL_UPLOAD));

        AiBlurJob duplicate =
                AiBlurJob.create(pinId, "videos/original/dup.mp4", AiBlurJobType.VIDEO_REPLACEMENT);

        assertThatThrownBy(() -> aiBlurJobRepository.saveAndFlush(duplicate))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("existsByOriginalVideoKey로 원본 영상 키 재사용 여부를 검사할 수 있다")
    void existsByOriginalVideoKey_works() {
        aiBlurJobRepository.saveAndFlush(
                AiBlurJob.create(pinId, "videos/original/exists.mp4", AiBlurJobType.INITIAL_UPLOAD));

        assertThat(aiBlurJobRepository.existsByOriginalVideoKey("videos/original/exists.mp4")).isTrue();
        assertThat(aiBlurJobRepository.existsByOriginalVideoKey("videos/original/absent.mp4")).isFalse();
    }

    @Test
    @DisplayName("재발행 대상: 특정 status·created_at 기준으로 오래된 순 조회가 가능하다(삭제되지 않은 핀)")
    void findRepublishTargets_byStatusAndCreatedAt() {
        // 오래된 PENDING(재발행 대상)
        AiBlurJob stalePending =
                AiBlurJob.create(pinId, "videos/original/stale.mp4", AiBlurJobType.INITIAL_UPLOAD);
        aiBlurJobRepository.saveAndFlush(stalePending);
        backdateCreatedAt(stalePending.getRequestId(), Instant.now().minus(30, ChronoUnit.MINUTES));

        // 최근 PENDING(임계 이후라 대상 아님)
        aiBlurJobRepository.saveAndFlush(
                AiBlurJob.create(pinId, "videos/original/fresh.mp4", AiBlurJobType.INITIAL_UPLOAD));

        // 완료된 작업(상태가 달라 대상 아님)
        AiBlurJob completed =
                AiBlurJob.create(pinId, "videos/original/done.mp4", AiBlurJobType.INITIAL_UPLOAD);
        completed.markCompleted(Instant.now());
        aiBlurJobRepository.saveAndFlush(completed);
        backdateCreatedAt(completed.getRequestId(), Instant.now().minus(40, ChronoUnit.MINUTES));

        em.clear();

        Instant threshold = Instant.now().minus(10, ChronoUnit.MINUTES);
        List<AiBlurJob> targets = aiBlurJobRepository
                .findRepublishTargetsExcludingDeletedPins(AiBlurJobStatus.PENDING, threshold);

        assertThat(targets)
                .extracting(AiBlurJob::getOriginalVideoKey)
                .containsExactly("videos/original/stale.mp4");
    }

    @Test
    @DisplayName("재발행 대상: 소프트 삭제된 핀의 오래된 PENDING 작업은 제외한다")
    void findRepublishTargets_excludesDeletedPinJobs() {
        Instant stale = Instant.now().minus(30, ChronoUnit.MINUTES);

        // 살아있는 핀의 오래된 PENDING(대상)
        AiBlurJob alive =
                AiBlurJob.create(pinId, "videos/original/alive.mp4", AiBlurJobType.INITIAL_UPLOAD);
        aiBlurJobRepository.saveAndFlush(alive);
        backdateCreatedAt(alive.getRequestId(), stale);

        // 소프트 삭제된 핀의 오래된 PENDING(제외)
        Member member = em.persist(Member.create("tester2", AgeGroup.TWENTIES, Gender.MALE));
        Place place = em.persist(Place.create("kakao-2", "삭제된 장소", point(127.03, 37.50)));
        Pin deletedPin = Pin.create(
                member, place, CrowdLevel.WAGLE, point(127.03, 37.50),
                null, null, "videos/original/deleted-pin.mp4", null);
        deletedPin.softDelete(Instant.now());
        em.persist(deletedPin);
        em.flush();
        AiBlurJob deletedPinJob = AiBlurJob.create(
                deletedPin.getId(), "videos/original/deleted-job.mp4", AiBlurJobType.VIDEO_REPLACEMENT);
        aiBlurJobRepository.saveAndFlush(deletedPinJob);
        backdateCreatedAt(deletedPinJob.getRequestId(), stale);

        em.clear();

        Instant threshold = Instant.now().minus(10, ChronoUnit.MINUTES);
        List<AiBlurJob> targets = aiBlurJobRepository
                .findRepublishTargetsExcludingDeletedPins(AiBlurJobStatus.PENDING, threshold);

        assertThat(targets)
                .extracting(AiBlurJob::getOriginalVideoKey)
                .containsExactly("videos/original/alive.mp4");
    }

    @Test
    @DisplayName("existsByPinIdAndJobTypeAndStatus로 진행 중 영상 교체 작업 존재 여부를 검사한다")
    void existsByPinIdAndJobTypeAndStatus_works() {
        // 진행 중(PENDING) 영상 교체 작업
        aiBlurJobRepository.saveAndFlush(
                AiBlurJob.create(pinId, "videos/original/replace-pending.mp4", AiBlurJobType.VIDEO_REPLACEMENT));

        // 완료된 교체 작업(상태가 달라 대상 아님)
        AiBlurJob completed =
                AiBlurJob.create(pinId, "videos/original/replace-done.mp4", AiBlurJobType.VIDEO_REPLACEMENT);
        completed.markCompleted(Instant.now());
        aiBlurJobRepository.saveAndFlush(completed);
        em.clear();

        assertThat(aiBlurJobRepository.existsByPinIdAndJobTypeAndStatus(
                pinId, AiBlurJobType.VIDEO_REPLACEMENT, AiBlurJobStatus.PENDING)).isTrue();
        // 최초 등록(INITIAL_UPLOAD) PENDING이 있어도 영상 교체 진행 중으로 보지 않는다.
        assertThat(aiBlurJobRepository.existsByPinIdAndJobTypeAndStatus(
                pinId, AiBlurJobType.INITIAL_UPLOAD, AiBlurJobStatus.PENDING)).isFalse();
        // 다른 핀에는 진행 중 교체 작업이 없다.
        assertThat(aiBlurJobRepository.existsByPinIdAndJobTypeAndStatus(
                UUID.randomUUID(), AiBlurJobType.VIDEO_REPLACEMENT, AiBlurJobStatus.PENDING)).isFalse();
    }

    @Test
    @DisplayName("findFirstByPinIdAndJobTypeOrderByCreatedAtDesc로 최신 영상 교체 작업을 조회한다")
    void findLatestReplacementJob() {
        // 과거 교체 작업
        AiBlurJob older =
                AiBlurJob.create(pinId, "videos/original/replace-old.mp4", AiBlurJobType.VIDEO_REPLACEMENT);
        aiBlurJobRepository.saveAndFlush(older);
        backdateCreatedAt(older.getRequestId(), Instant.now().minus(30, ChronoUnit.MINUTES));

        // 최신 교체 작업
        AiBlurJob newer =
                AiBlurJob.create(pinId, "videos/original/replace-new.mp4", AiBlurJobType.VIDEO_REPLACEMENT);
        aiBlurJobRepository.saveAndFlush(newer);
        backdateCreatedAt(newer.getRequestId(), Instant.now().minus(5, ChronoUnit.MINUTES));

        // 최초 등록 작업(유형이 달라 대상 아님)
        aiBlurJobRepository.saveAndFlush(
                AiBlurJob.create(pinId, "videos/original/initial.mp4", AiBlurJobType.INITIAL_UPLOAD));
        em.clear();

        AiBlurJob latest = aiBlurJobRepository
                .findFirstByPinIdAndJobTypeOrderByCreatedAtDesc(pinId, AiBlurJobType.VIDEO_REPLACEMENT)
                .orElseThrow();
        assertThat(latest.getRequestId()).isEqualTo(newer.getRequestId());

        // 교체 작업이 없는 다른 핀은 빈 결과
        assertThat(aiBlurJobRepository.findFirstByPinIdAndJobTypeOrderByCreatedAtDesc(
                UUID.randomUUID(), AiBlurJobType.VIDEO_REPLACEMENT)).isEmpty();
    }

    private Point point(double lng, double lat) {
        Point p = GF.createPoint(new Coordinate(lng, lat));
        p.setSRID(4326);
        return p;
    }

    /** created_at은 @CreationTimestamp라 앱에서 지정 불가하므로, 조회 조건 검증을 위해 네이티브로 과거로 조정한다. */
    private void backdateCreatedAt(UUID requestId, Instant createdAt) {
        em.getEntityManager()
                .createNativeQuery("UPDATE ai_blur_jobs SET created_at = :ts WHERE request_id = :id")
                .setParameter("ts", createdAt)
                .setParameter("id", requestId)
                .executeUpdate();
    }
}
