package com.yuhan.wagglewaggle.domain.pin.service;

import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJob;
import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJobStatus;
import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJobType;
import com.yuhan.wagglewaggle.domain.blur.repository.AiBlurJobRepository;
import com.yuhan.wagglewaggle.domain.pin.dto.ValidatedPinCreation;
import com.yuhan.wagglewaggle.domain.pin.entity.CrowdLevel;
import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import com.yuhan.wagglewaggle.domain.pin.entity.PinTag;
import com.yuhan.wagglewaggle.domain.pin.entity.VideoStatus;
import com.yuhan.wagglewaggle.domain.pin.repository.PinRepository;
import com.yuhan.wagglewaggle.domain.pin.repository.PinTagRepository;
import com.yuhan.wagglewaggle.domain.place.entity.Place;
import com.yuhan.wagglewaggle.domain.place.repository.PlaceRepository;
import com.yuhan.wagglewaggle.domain.user.entity.AgeGroup;
import com.yuhan.wagglewaggle.domain.user.entity.Gender;
import com.yuhan.wagglewaggle.domain.user.entity.Member;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 핀 등록 저장을 실제 PostGIS(PostgreSQL) 컨테이너 위에서 한 트랜잭션으로 검증한다.
 * Flyway 마이그레이션 스키마 위에서 Pin·PinTag·AiBlurJob·Place가 정상 저장되는지 확인한다.
 */
@DataJpaTest
@ActiveProfiles("test")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import(PinPersistenceService.class)
@Testcontainers
class PinPersistenceServiceJpaTest {

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

    private static final String KEY = "pins/original/1/11111111-2222-3333-4444-555555555555.mp4";
    private static final String KAKAO_PLACE_ID = "kakao-1";
    private static final double PLACE_LAT = 37.500000;
    private static final double PLACE_LNG = 127.030000;

    @Autowired private PinPersistenceService service;
    @Autowired private TestEntityManager em;
    @Autowired private PinRepository pinRepository;
    @Autowired private PinTagRepository pinTagRepository;
    @Autowired private AiBlurJobRepository aiBlurJobRepository;
    @Autowired private PlaceRepository placeRepository;

    @Test
    @DisplayName("Pin·PinTag·AiBlurJob(INITIAL_UPLOAD)을 한 트랜잭션으로 저장하고 장소를 신규 생성한다")
    void save_persistsAllEntities() {
        Member member = em.persist(Member.create("tester", AgeGroup.TWENTIES, Gender.MALE));
        em.flush();

        ValidatedPinCreation validated = new ValidatedPinCreation(
                member.getId(), KEY, KAKAO_PLACE_ID, "테스트 장소",
                PLACE_LAT, PLACE_LNG,
                "CE7", "카페", "02-123-4567", "서울 강남구 역삼동 858",
                PLACE_LAT + 0.0001, PLACE_LNG + 0.0001,
                "2층 창가", CrowdLevel.WAGLE, "메모", List.of("카페", "조용함"));

        PinPersistenceService.Result result = service.save(validated);
        em.flush();
        em.clear();

        UUID pinId = result.pin().getId();
        assertThat(pinId).isNotNull();

        Pin savedPin = pinRepository.findById(pinId).orElseThrow();
        assertThat(savedPin.getVideoStatus()).isEqualTo(VideoStatus.PENDING);
        assertThat(savedPin.getOriginalVideoKey()).isEqualTo(KEY);
        assertThat(savedPin.getExpiresAt()).isNull();

        List<PinTag> tags = pinTagRepository.findByPin_IdIn(List.of(pinId));
        assertThat(tags).extracting(PinTag::getTag).containsExactlyInAnyOrder("카페", "조용함");

        List<AiBlurJob> jobs = aiBlurJobRepository.findByPinIdOrderByCreatedAtDesc(pinId);
        assertThat(jobs).hasSize(1);
        AiBlurJob job = jobs.get(0);
        assertThat(job.getJobType()).isEqualTo(AiBlurJobType.INITIAL_UPLOAD);
        assertThat(job.getStatus()).isEqualTo(AiBlurJobStatus.PENDING);
        assertThat(job.getOriginalVideoKey()).isEqualTo(KEY);

        Place savedPlace = placeRepository.findFirstByKakaoPlaceId(KAKAO_PLACE_ID).orElseThrow();
        assertThat(savedPlace.getName()).isEqualTo("테스트 장소");
    }
}
