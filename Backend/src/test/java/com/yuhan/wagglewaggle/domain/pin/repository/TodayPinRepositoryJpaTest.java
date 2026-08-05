package com.yuhan.wagglewaggle.domain.pin.repository;

import com.yuhan.wagglewaggle.domain.pin.entity.CrowdLevel;
import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import com.yuhan.wagglewaggle.domain.pin.entity.VideoStatus;
import com.yuhan.wagglewaggle.domain.place.entity.Place;
import com.yuhan.wagglewaggle.domain.place.entity.PlaceCategory;
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
import org.springframework.data.domain.PageRequest;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 오늘 등록 핀 목록 커서 조회 쿼리를 실제 PostgreSQL 위에서 검증한다.
 * 오늘 윈도우(createdAt >= start AND < end) 경계, 소프트 삭제·작성자 필터, 상태 무관 포함,
 * (createdAt DESC, id DESC) 정렬과 커서 튜플 비교가 SQL에서 정확히 동작하는지 확인한다.
 */
class TodayPinRepositoryJpaTest extends AbstractPostgresContainerTest {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    private static final GeometryFactory GF = new GeometryFactory(new PrecisionModel(), 4326);

    // 오늘 윈도우 [start, end) = 2026-08-03 04:00 KST ~ 2026-08-04 04:00 KST
    private static final Instant START = kst(2026, 8, 3, 4, 0);
    private static final Instant END = kst(2026, 8, 4, 4, 0);
    private static final PageRequest UNBOUNDED = PageRequest.of(0, 100);

    @Autowired private TestEntityManager em;
    @Autowired private PinRepository pinRepository;

    @Test
    @DisplayName("오늘 윈도우·본인·미삭제 핀만 모든 상태로 포함하고 createdAt 내림차순으로 정렬한다")
    void firstPage_windowAndFilters() {
        Member author = persistMember("author");
        Member other = persistMember("other");
        Place place = persistPlace();

        Pin p23 = persistPin(author, place, VideoStatus.REJECTED, false, kst(2026, 8, 3, 23, 0));
        Pin p12 = persistPin(author, place, VideoStatus.FAILED, false, kst(2026, 8, 3, 12, 0));
        Pin p10 = persistPin(author, place, VideoStatus.PENDING, false, kst(2026, 8, 3, 10, 0));
        Pin p04 = persistPin(author, place, VideoStatus.ACTIVE, false, kst(2026, 8, 3, 4, 0)); // == start(포함)
        // 제외 대상
        persistPin(author, place, VideoStatus.ACTIVE, false, kst(2026, 8, 3, 3, 59)); // start 이전
        persistPin(author, place, VideoStatus.ACTIVE, false, kst(2026, 8, 4, 4, 0));  // == end(제외)
        persistPin(author, place, VideoStatus.ACTIVE, true, kst(2026, 8, 3, 15, 0));  // 소프트 삭제
        persistPin(other, place, VideoStatus.ACTIVE, false, kst(2026, 8, 3, 15, 0));  // 타인 핀

        em.flush();
        em.clear();

        List<Pin> result = pinRepository.findTodayPinsFirstPage(author.getId(), START, END, UNBOUNDED);

        assertThat(result).extracting(Pin::getId)
                .containsExactly(p23.getId(), p12.getId(), p10.getId(), p04.getId());
        // place가 fetch join으로 로딩되어 장소명·주소 접근이 가능하다
        assertThat(result.get(0).getPlace().getName()).isEqualTo("테스트 카페");
    }

    @Test
    @DisplayName("createdAt이 같으면 id 내림차순으로 정렬한다")
    void firstPage_idTiebreakDesc() {
        Member author = persistMember("author");
        Place place = persistPlace();
        Instant sameTime = kst(2026, 8, 3, 20, 0);
        persistPin(author, place, VideoStatus.ACTIVE, false, sameTime);
        persistPin(author, place, VideoStatus.ACTIVE, false, sameTime);

        em.flush();
        em.clear();

        List<Pin> result = pinRepository.findTodayPinsFirstPage(author.getId(), START, END, UNBOUNDED);

        assertThat(result).hasSize(2);
        // Postgres uuid는 부호 없는 바이트 비교로 정렬되므로 동일 기준으로 내림차순임을 확인한다.
        assertThat(unsignedUuidCompare(result.get(0).getId(), result.get(1).getId())).isPositive();
    }

    @Test
    @DisplayName("커서 이후 페이지는 createdAt이 커서보다 이른 핀만 정렬 순으로 반환한다")
    void afterCursor_returnsStrictlyAfterByCreatedAt() {
        Member author = persistMember("author");
        Place place = persistPlace();
        persistPin(author, place, VideoStatus.ACTIVE, false, kst(2026, 8, 3, 23, 0));
        Pin p12 = persistPin(author, place, VideoStatus.ACTIVE, false, kst(2026, 8, 3, 12, 0));
        Pin p10 = persistPin(author, place, VideoStatus.ACTIVE, false, kst(2026, 8, 3, 10, 0));
        Pin p04 = persistPin(author, place, VideoStatus.ACTIVE, false, kst(2026, 8, 3, 4, 0));

        em.flush();
        em.clear();

        // 커서 = p12 → p12보다 뒤(더 이른)인 p10, p04만 반환
        List<Pin> result = pinRepository.findTodayPinsAfterCursor(
                author.getId(), START, END, p12.getCreatedAt(), p12.getId(), UNBOUNDED);

        assertThat(result).extracting(Pin::getId).containsExactly(p10.getId(), p04.getId());
    }

    @Test
    @DisplayName("커서와 createdAt이 같으면 id가 커서보다 뒤인 핀만 반환한다(튜플 비교)")
    void afterCursor_idTiebreak() {
        Member author = persistMember("author");
        Place place = persistPlace();
        Instant sameTime = kst(2026, 8, 3, 20, 0);
        persistPin(author, place, VideoStatus.ACTIVE, false, sameTime);
        persistPin(author, place, VideoStatus.ACTIVE, false, sameTime);
        persistPin(author, place, VideoStatus.ACTIVE, false, kst(2026, 8, 3, 10, 0));

        em.flush();
        em.clear();

        // DB 정렬 순서(createdAt DESC, id DESC)를 그대로 사용한다.
        // (Java UUID.compareTo는 부호 있는 비교라 Postgres의 부호 없는 uuid 비교와 다를 수 있어 직접 예단하지 않는다.)
        List<Pin> ordered = pinRepository.findTodayPinsFirstPage(author.getId(), START, END, UNBOUNDED);
        assertThat(ordered).hasSize(3);
        Pin cursorPin = ordered.get(0); // 같은 시각 두 핀 중 정렬상 첫 번째

        // 커서 이후에는 같은 시각의 나머지 한 핀과 더 이른 핀이 정렬 순으로 남는다
        List<Pin> result = pinRepository.findTodayPinsAfterCursor(
                author.getId(), START, END, cursorPin.getCreatedAt(), cursorPin.getId(), UNBOUNDED);

        assertThat(result).extracting(Pin::getId)
                .containsExactly(ordered.get(1).getId(), ordered.get(2).getId());
    }

    // ===== helpers =====

    private static Instant kst(int year, int month, int day, int hour, int minute) {
        return LocalDateTime.of(year, month, day, hour, minute, 0).atZone(KST).toInstant();
    }

    /** Postgres uuid 비교(부호 없는 16바이트 사전식)와 동일하게 두 UUID를 비교한다. */
    private static int unsignedUuidCompare(UUID a, UUID b) {
        int hi = Long.compareUnsigned(a.getMostSignificantBits(), b.getMostSignificantBits());
        return hi != 0 ? hi : Long.compareUnsigned(a.getLeastSignificantBits(), b.getLeastSignificantBits());
    }

    private Member persistMember(String nickname) {
        return em.persist(Member.create(nickname, AgeGroup.TWENTIES, Gender.FEMALE));
    }

    private Place persistPlace() {
        return em.persist(Place.create("kakao-1", "테스트 카페", GF.createPoint(new Coordinate(127.03, 37.5)),
                PlaceCategory.CAFE, "CE7", "음식점 > 카페", "음식점 > 카페", "", "서울 광진구 동일로60길 47 1층 (군자동)"));
    }

    /** createdAt(등록 시각)과 상태·소프트 삭제 여부를 지정해 핀을 저장한다. */
    private Pin persistPin(Member member, Place place, VideoStatus status, boolean deleted, Instant createdAt) {
        Pin pin = Pin.create(
                member, place, CrowdLevel.WAGLE,
                GF.createPoint(new Coordinate(127.0, 37.5)),
                "2층 창가", "조용해요", "pins/original/1/" + UUID.randomUUID() + ".mp4", null);
        ReflectionTestUtils.setField(pin, "videoStatus", status);
        if (deleted) {
            ReflectionTestUtils.setField(pin, "deletedAt", Instant.now());
        }
        em.persist(pin);
        // JPA Auditing이 persist 시점에 created_at을 현재 시각으로 채우므로, 원하는 등록 시각으로 덮어쓴다.
        ReflectionTestUtils.setField(pin, "createdAt", createdAt);
        em.flush();
        return pin;
    }
}
