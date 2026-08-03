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

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    @Column(name = "location", columnDefinition = "geography(Point,4326)", nullable = false)
    private Point location;

    // 카카오 장소 부가 정보. 카카오가 값을 주지 않는 경우가 흔해 빈 문자열을 기본값으로 둔다(컬럼 NOT NULL DEFAULT '').
    @Column(name = "category_group_code", nullable = false, length = 10)
    private String categoryGroupCode = "";

    @Column(name = "category_group_name", nullable = false, length = 50)
    private String categoryGroupName = "";

    @Column(name = "phone", nullable = false, length = 50)
    private String phone = "";

    @Column(name = "address_name", nullable = false, length = 255)
    private String addressName = "";

    private Place(String kakaoPlaceId, String name, Point location) {
        this.kakaoPlaceId = kakaoPlaceId;
        this.name = name;
        this.location = location;
    }

    private Place(String kakaoPlaceId, String name, Point location,
                  String categoryGroupCode, String categoryGroupName, String phone, String addressName) {
        this(kakaoPlaceId, name, location);
        // 컬럼이 NOT NULL 이므로 null 이 들어와도 빈 문자열로 방어한다.
        this.categoryGroupCode = (categoryGroupCode != null) ? categoryGroupCode : "";
        this.categoryGroupName = (categoryGroupName != null) ? categoryGroupName : "";
        this.phone = (phone != null) ? phone : "";
        this.addressName = (addressName != null) ? addressName : "";
    }

    public static Place create(String kakaoPlaceId, String name, Point location) {
        return new Place(kakaoPlaceId, name, location);
    }

    public static Place create(String kakaoPlaceId, String name, Point location,
                               String categoryGroupCode, String categoryGroupName,
                               String phone, String addressName) {
        return new Place(kakaoPlaceId, name, location,
                categoryGroupCode, categoryGroupName, phone, addressName);
    }
}
