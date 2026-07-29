package com.yuhan.wagglewaggle.domain.place.entity;

import com.yuhan.wagglewaggle.global.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.locationtech.jts.geom.Point;

@Getter
@Entity
@Table(name = "places")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Place extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "kakao_place_id", nullable = false, length = 200)
    private String kakaoPlaceId;

    @Column(name = "kakao_place_url", nullable = false, length = 500)
    private String kakaoPlaceUrl;

    @Column(name = "location", columnDefinition = "geography(Point,4326)", nullable = false)
    private Point location;

    private Place(String kakaoPlaceId, String kakaoPlaceUrl, Point location) {
        this.kakaoPlaceId = kakaoPlaceId;
        this.kakaoPlaceUrl = kakaoPlaceUrl;
        this.location = location;
    }

    public static Place create(String kakaoPlaceId, String kakaoPlaceUrl, Point location) {
        return new Place(kakaoPlaceId, kakaoPlaceUrl, location);
    }
}
