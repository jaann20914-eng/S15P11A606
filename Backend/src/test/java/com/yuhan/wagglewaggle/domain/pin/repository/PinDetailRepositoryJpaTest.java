package com.yuhan.wagglewaggle.domain.pin.repository;

import com.yuhan.wagglewaggle.domain.pin.entity.CrowdLevel;
import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import com.yuhan.wagglewaggle.domain.pin.entity.VideoStatus;
import com.yuhan.wagglewaggle.domain.place.entity.Place;
import com.yuhan.wagglewaggle.domain.user.entity.AgeGroup;
import com.yuhan.wagglewaggle.domain.user.entity.Gender;
import com.yuhan.wagglewaggle.domain.user.entity.Member;
import com.yuhan.wagglewaggle.support.AbstractPostgresContainerTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 영상 핀 상세 조회 쿼리의 "조회 가능한 핀" 판정을 실제 PostGIS(PostgreSQL) 위에서 검증한다.
 * ACTIVE·미삭제·미만료를 모두 만족하는 핀만 반환하고, PENDING·REJECTED·FAILED·삭제·만료는
 * 모두 빈 결과가 되는지, fetch join으로 작성자·장소가 함께 로딩되는지 확인한다.
 */
class PinDetailRepositoryJpaTest extends AbstractPostgresContainerTest {

    private static final GeometryFactory GF = new GeometryFactory(new PrecisionModel(), 4326);
    private static final double PLACE_LAT = 37.500000;
    private static final double PLACE_LNG = 127.030000;

    @Autowired private TestEntityManager em;
    @Autowired private PinRepository pinRepository;

    @Test
    @DisplayName("ACTIVE·미삭제·미만료 핀은 작성자·장소와 함께 조회된다")
    void findActivePinDetailById_returnsActivePin() {
        Pin pin = persistPin(VideoStatus.ACTIVE, futureExpiry(), false);
        flushAndClear();

        Optional<Pin> found = pinRepository.findActivePinDetailById(pin.getId(), Instant.now());

        assertThat(found).isPresent();
        Pin result = found.get();
        assertThat(result.getId()).isEqualTo(pin.getId());
        // fetch join 으로 작성자·장소가 함께 로딩된다.
        assertThat(result.getMember().getNickname()).isEqualTo("author");
        assertThat(result.getPlace().getName()).isEqualTo("테스트 카페");
        assertThat(result.getPlace().getLocation().getY()).isEqualTo(PLACE_LAT);
        assertThat(result.getPlace().getLocation().getX()).isEqualTo(PLACE_LNG);
    }

    @Test
    @DisplayName("존재하지 않는 pinId는 빈 결과다")
    void findActivePinDetailById_missingPin_empty() {
        assertThat(pinRepository.findActivePinDetailById(UUID.randomUUID(), Instant.now())).isEmpty();
    }

    @Test
    @DisplayName("PENDING 핀은 빈 결과다")
    void findActivePinDetailById_pending_empty() {
        Pin pin = persistPin(VideoStatus.PENDING, null, false);
        flushAndClear();
        assertThat(pinRepository.findActivePinDetailById(pin.getId(), Instant.now())).isEmpty();
    }

    @Test
    @DisplayName("REJECTED 핀은 빈 결과다")
    void findActivePinDetailById_rejected_empty() {
        Pin pin = persistPin(VideoStatus.REJECTED, null, false);
        flushAndClear();
        assertThat(pinRepository.findActivePinDetailById(pin.getId(), Instant.now())).isEmpty();
    }

    @Test
    @DisplayName("FAILED 핀은 빈 결과다")
    void findActivePinDetailById_failed_empty() {
        Pin pin = persistPin(VideoStatus.FAILED, null, false);
        flushAndClear();
        assertThat(pinRepository.findActivePinDetailById(pin.getId(), Instant.now())).isEmpty();
    }

    @Test
    @DisplayName("삭제된 ACTIVE 핀은 빈 결과다")
    void findActivePinDetailById_deleted_empty() {
        Pin pin = persistPin(VideoStatus.ACTIVE, futureExpiry(), true);
        flushAndClear();
        assertThat(pinRepository.findActivePinDetailById(pin.getId(), Instant.now())).isEmpty();
    }

    @Test
    @DisplayName("만료된 ACTIVE 핀은 빈 결과다")
    void findActivePinDetailById_expired_empty() {
        Pin pin = persistPin(VideoStatus.ACTIVE, Instant.now().minus(Duration.ofMinutes(1)), false);
        flushAndClear();
        assertThat(pinRepository.findActivePinDetailById(pin.getId(), Instant.now())).isEmpty();
    }

    private Instant futureExpiry() {
        return Instant.now().plus(Duration.ofMinutes(30));
    }

    private Pin persistPin(VideoStatus status, Instant expiresAt, boolean deleted) {
        Member member = em.persist(Member.create("author", AgeGroup.TWENTIES, Gender.FEMALE));
        Point placePoint = GF.createPoint(new Coordinate(PLACE_LNG, PLACE_LAT));
        Place place = em.persist(Place.create("kakao-1", "테스트 카페", placePoint));

        Pin pin = Pin.create(
                member, place, CrowdLevel.WAGLE,
                GF.createPoint(new Coordinate(127.0, 37.5)),
                "2층 창가", "조용해요", uniqueKey(), null);
        ReflectionTestUtils.setField(pin, "videoStatus", status);
        ReflectionTestUtils.setField(pin, "expiresAt", expiresAt);
        if (deleted) {
            ReflectionTestUtils.setField(pin, "deletedAt", Instant.now());
        }
        return em.persist(pin);
    }

    private String uniqueKey() {
        return "pins/original/1/" + UUID.randomUUID() + ".mp4";
    }

    private void flushAndClear() {
        em.flush();
        em.clear();
    }
}
