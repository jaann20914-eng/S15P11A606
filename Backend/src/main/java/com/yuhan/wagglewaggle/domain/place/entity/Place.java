package com.yuhan.wagglewaggle.domain.place.entity;

import com.yuhan.wagglewaggle.global.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
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

    // 추천 카테고리 분류(6종 + ETC). 값 제한을 위해 PostgreSQL enum 타입 category_type 으로 저장한다.
    @Enumerated(EnumType.STRING)
    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Column(name = "category", columnDefinition = "category_type", nullable = false)
    private PlaceCategory category;

    // 카카오 장소 부가 정보. 카카오가 값을 주지 않는 경우가 흔해 그룹코드/그룹명/카테고리명은 NULL 을 허용한다.
    @Column(name = "category_group_code", length = 10)
    private String categoryGroupCode;

    @Column(name = "category_group_name", length = 50)
    private String categoryGroupName;

    // 카카오 전체 카테고리 경로(예: "가정,생활 > 공원"). 쇼핑몰/공원 분류 판정에 사용한다.
    @Column(name = "category_name", length = 255)
    private String categoryName;

    @Column(name = "phone", nullable = false, length = 50)
    private String phone = "";

    @Column(name = "address_name", nullable = false, length = 255)
    private String addressName = "";

    private Place(String kakaoPlaceId, String name, Point location) {
        this.kakaoPlaceId = kakaoPlaceId;
        this.name = name;
        this.location = location;
        this.category = PlaceCategory.ETC;
    }

    private Place(String kakaoPlaceId, String name, Point location,
                  PlaceCategory category,
                  String categoryGroupCode, String categoryGroupName, String categoryName,
                  String phone, String addressName) {
        this.kakaoPlaceId = kakaoPlaceId;
        this.name = name;
        this.location = location;
        this.category = (category != null) ? category : PlaceCategory.ETC;
        this.categoryGroupCode = categoryGroupCode;
        this.categoryGroupName = categoryGroupName;
        this.categoryName = categoryName;
        // phone/address_name 은 NOT NULL 이므로 null 이 들어와도 빈 문자열로 방어한다.
        this.phone = (phone != null) ? phone : "";
        this.addressName = (addressName != null) ? addressName : "";
    }

    public static Place create(String kakaoPlaceId, String name, Point location) {
        return new Place(kakaoPlaceId, name, location);
    }

    public static Place create(String kakaoPlaceId, String name, Point location,
                               PlaceCategory category,
                               String categoryGroupCode, String categoryGroupName, String categoryName,
                               String phone, String addressName) {
        return new Place(kakaoPlaceId, name, location,
                category, categoryGroupCode, categoryGroupName, categoryName, phone, addressName);
    }
}
