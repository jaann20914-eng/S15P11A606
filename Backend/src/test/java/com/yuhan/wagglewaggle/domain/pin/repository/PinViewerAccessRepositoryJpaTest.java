package com.yuhan.wagglewaggle.domain.pin.repository;

import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoom;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoomStatus;
import com.yuhan.wagglewaggle.domain.chat.repository.ChatRoomRepository;
import com.yuhan.wagglewaggle.domain.pin.entity.CrowdLevel;
import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import com.yuhan.wagglewaggle.domain.pin.entity.PinEvaluation;
import com.yuhan.wagglewaggle.domain.pin.entity.PinEvaluationType;
import com.yuhan.wagglewaggle.domain.pin.entity.PinUnlock;
import com.yuhan.wagglewaggle.domain.pin.entity.VideoStatus;
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
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 핀 상세 접근 정보 판정에 쓰이는 신규 조회 쿼리(PinUnlock/PinEvaluation 존재 여부, 채팅방 상태)를
 * 실제 PostGIS(PostgreSQL) 스키마 위에서 검증한다. 파생 쿼리·JPQL의 프로퍼티 경로가 유효한지
 * (컨텍스트 로드 시점 검증)와 결과가 기대대로인지를 함께 확인한다.
 */
@DataJpaTest
@ActiveProfiles("test")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers
class PinViewerAccessRepositoryJpaTest {

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

    @Autowired private TestEntityManager em;
    @Autowired private PinUnlockRepository pinUnlockRepository;
    @Autowired private PinEvaluationRepository pinEvaluationRepository;
    @Autowired private ChatRoomRepository chatRoomRepository;

    @Test
    @DisplayName("PinUnlock·PinEvaluation 존재 여부와 채팅방 상태 조회가 실제 스키마에서 동작한다")
    void viewerAccessQueries_work() {
        Member author = em.persist(Member.create("author", AgeGroup.TWENTIES, Gender.FEMALE));
        Member viewer = em.persist(Member.create("viewer", AgeGroup.THIRTIES, Gender.MALE));
        Member other = em.persist(Member.create("other", AgeGroup.FORTIES, Gender.FEMALE));
        Place place = em.persist(Place.create(
                "kakao-1", "테스트 카페", GF.createPoint(new Coordinate(127.03, 37.5))));

        Pin pin = Pin.create(
                author, place, CrowdLevel.WAGLE,
                GF.createPoint(new Coordinate(127.0, 37.5)),
                "2층 창가", "조용해요", "pins/original/1/" + UUID.randomUUID() + ".mp4",
                Instant.now().plus(Duration.ofMinutes(30)));
        ReflectionTestUtils.setField(pin, "videoStatus", VideoStatus.ACTIVE);
        em.persist(pin);

        em.persist(PinUnlock.create(pin, viewer, UUID.randomUUID()));
        em.persist(PinEvaluation.create(pin, viewer, PinEvaluationType.HELPFUL));
        ChatRoom room = ChatRoom.create(pin, viewer, UUID.randomUUID());
        ReflectionTestUtils.setField(room, "status", ChatRoomStatus.REFUSED);
        em.persist(room);

        em.flush();
        em.clear();

        UUID pinId = pin.getId();

        // PinUnlock 존재 여부
        assertThat(pinUnlockRepository.existsByPin_IdAndMember_Id(pinId, viewer.getId())).isTrue();
        assertThat(pinUnlockRepository.existsByPin_IdAndMember_Id(pinId, other.getId())).isFalse();

        // PinEvaluation 존재 여부
        assertThat(pinEvaluationRepository.existsByPin_IdAndMember_Id(pinId, viewer.getId())).isTrue();
        assertThat(pinEvaluationRepository.existsByPin_IdAndMember_Id(pinId, other.getId())).isFalse();

        // 채팅방 상태(요청자 기준)
        Optional<ChatRoomStatus> viewerStatus =
                chatRoomRepository.findStatusByPinIdAndRequesterId(pinId, viewer.getId());
        assertThat(viewerStatus).contains(ChatRoomStatus.REFUSED);
        assertThat(chatRoomRepository.findStatusByPinIdAndRequesterId(pinId, other.getId())).isEmpty();
    }
}
