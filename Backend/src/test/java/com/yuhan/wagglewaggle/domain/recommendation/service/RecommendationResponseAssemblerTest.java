package com.yuhan.wagglewaggle.domain.recommendation.service;

import com.yuhan.wagglewaggle.domain.pin.entity.CrowdLevel;
import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import com.yuhan.wagglewaggle.domain.place.entity.Place;
import com.yuhan.wagglewaggle.domain.place.entity.PlaceCategory;
import com.yuhan.wagglewaggle.domain.recommendation.cache.RecommendationCacheEntry.CachedPlace;
import com.yuhan.wagglewaggle.domain.recommendation.dto.PlaceCard;
import com.yuhan.wagglewaggle.domain.user.entity.AgeGroup;
import com.yuhan.wagglewaggle.domain.user.entity.Gender;
import com.yuhan.wagglewaggle.domain.user.entity.Member;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.PrecisionModel;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 응답 조립기의 규칙(대표핀 재선정, 활성핀 없는 장소 제외, 미리보기 5개 제한, limit 적용, phone 빈값→null)을 검증한다.
 */
class RecommendationResponseAssemblerTest {

    private static final GeometryFactory GF = new GeometryFactory(new PrecisionModel(), 4326);

    private final RecommendationResponseAssembler assembler = new RecommendationResponseAssembler();

    private final Member author = member(100L, "author");

    @Test
    @DisplayName("현재 활성 핀이 없는 장소는 응답에서 제외된다")
    void excludesPlaceWithoutActivePins() {
        Place present = place(1L, "phone-present", "02-111");
        Place empty = place(2L, "phone-empty", "");
        Pin pin = pin(present, 10);

        List<PlaceCard> cards = assembler.assemble(
                List.of(new CachedPlace(1L, pin.getId()), new CachedPlace(2L, UUID.randomUUID())),
                5,
                Map.of(1L, present, 2L, empty),
                Map.of(1L, List.of(pin))); // place 2는 활성 핀 없음

        assertThat(cards).hasSize(1);
        assertThat(cards.get(0).placeId()).isEqualTo(1L);
        assertThat(cards.get(0).phone()).isEqualTo("02-111");
    }

    @Test
    @DisplayName("캐시 대표핀이 비활성이면 가장 최근 활성 핀으로 재선정한다")
    void reselectsRepresentativeWhenCachedInvalid() {
        Place place = place(1L, "p", "");
        Pin newest = pin(place, 50);
        Pin older = pin(place, 10);
        // 입력은 활성화 시각 내림차순(newest 먼저)
        List<Pin> pins = List.of(newest, older);

        List<PlaceCard> cards = assembler.assemble(
                List.of(new CachedPlace(1L, UUID.randomUUID())), // 존재하지 않는 대표핀 id
                5, Map.of(1L, place), Map.of(1L, pins));

        assertThat(cards.get(0).pinPreviews().get(0).pinId()).isEqualTo(newest.getId());
        assertThat(cards.get(0).phone()).isNull(); // 빈 문자열 → null
    }

    @Test
    @DisplayName("캐시 대표핀이 아직 활성이면 pinPreviews[0]에 그대로 둔다")
    void keepsCachedRepresentativeWhenActive() {
        Place place = place(1L, "p", "");
        Pin newest = pin(place, 50);
        Pin older = pin(place, 10);
        List<Pin> pins = List.of(newest, older);

        List<PlaceCard> cards = assembler.assemble(
                List.of(new CachedPlace(1L, older.getId())), // 대표핀으로 older 지정
                5, Map.of(1L, place), Map.of(1L, pins));

        assertThat(cards.get(0).pinPreviews().get(0).pinId()).isEqualTo(older.getId());
        assertThat(cards.get(0).representativeUploaderNickname()).isEqualTo("author");
    }

    @Test
    @DisplayName("pinPreviews는 최대 5개까지만 반환한다")
    void limitsPinPreviewsToFive() {
        Place place = place(1L, "p", "");
        List<Pin> pins = new ArrayList<>();
        for (int i = 0; i < 8; i++) {
            pins.add(pin(place, 60 - i));
        }
        List<PlaceCard> cards = assembler.assemble(
                List.of(new CachedPlace(1L, pins.get(0).getId())),
                5, Map.of(1L, place), Map.of(1L, pins));

        assertThat(cards.get(0).pinPreviews()).hasSize(5);
        assertThat(cards.get(0).activePinCount()).isEqualTo(8);
    }

    @Test
    @DisplayName("limit은 활성 핀이 있는 장소 기준으로 유형별 최대 개수를 적용한다")
    void appliesLimit() {
        Place p1 = place(1L, "p1", "");
        Place p2 = place(2L, "p2", "");
        Place p3 = place(3L, "p3", "");
        Pin pin1 = pin(p1, 10);
        Pin pin2 = pin(p2, 10);
        Pin pin3 = pin(p3, 10);

        List<PlaceCard> cards = assembler.assemble(
                List.of(new CachedPlace(1L, pin1.getId()),
                        new CachedPlace(2L, pin2.getId()),
                        new CachedPlace(3L, pin3.getId())),
                2,
                Map.of(1L, p1, 2L, p2, 3L, p3),
                Map.of(1L, List.of(pin1), 2L, List.of(pin2), 3L, List.of(pin3)));

        assertThat(cards).hasSize(2);
        assertThat(cards).extracting(PlaceCard::placeId).containsExactly(1L, 2L);
    }

    private Member member(long id, String nickname) {
        Member m = Member.create(nickname, AgeGroup.TWENTIES, Gender.FEMALE);
        ReflectionTestUtils.setField(m, "id", id);
        return m;
    }

    private Place place(long id, String name, String phone) {
        Place p = Place.create("kakao-" + id, name, GF.createPoint(new Coordinate(127.0, 37.5)),
                PlaceCategory.CAFE, "CE7", null, null, phone, "주소");
        ReflectionTestUtils.setField(p, "id", id);
        return p;
    }

    private Pin pin(Place place, int expiryMinutes) {
        Pin p = Pin.create(author, place, CrowdLevel.RELAXED,
                GF.createPoint(new Coordinate(127.0, 37.5)), "d", "m",
                "pins/original/100/" + UUID.randomUUID() + ".mp4",
                Instant.now().plus(Duration.ofMinutes(expiryMinutes)));
        ReflectionTestUtils.setField(p, "id", UUID.randomUUID());
        return p;
    }
}
