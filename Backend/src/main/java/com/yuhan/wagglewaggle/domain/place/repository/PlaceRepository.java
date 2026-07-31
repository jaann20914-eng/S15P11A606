package com.yuhan.wagglewaggle.domain.place.repository;

import com.yuhan.wagglewaggle.domain.place.entity.Place;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PlaceRepository extends JpaRepository<Place, Long> {

    /**
     * 카카오 장소 ID로 저장된 장소를 조회한다.
     * kakao_place_id는 카카오 고유 ID라 사실상 유일하며, 장소 검색 확정 시 우리 DB 존재 여부 판별에 사용한다.
     */
    Optional<Place> findByKakaoPlaceId(String kakaoPlaceId);

    /**
     * kakaoPlaceId로 기존 장소를 조회한다(핀 등록 시 장소 재사용·좌표 확인용).
     * 유니크 제약이 없어 동일 kakaoPlaceId가 중복 저장돼 있어도 첫 건을 반환한다.
     */
    Optional<Place> findFirstByKakaoPlaceId(String kakaoPlaceId);

    /**
     * 지도 경계(bounding box) 안에 위치한 장소를 조회한다.
     * ST_MakeEnvelope 인자 순서는 (minLng, minLat, maxLng, maxLat, srid) 이다.
     */
    @Query(value = """
            SELECT * FROM places p
            WHERE ST_Covers(
                ST_MakeEnvelope(:swLng, :swLat, :neLng, :neLat, 4326)::geography,
                p.location
            )
            """, nativeQuery = true)
    List<Place> findWithinBounds(
            @Param("swLng") double swLng,
            @Param("swLat") double swLat,
            @Param("neLng") double neLng,
            @Param("neLat") double neLat
    );
}
