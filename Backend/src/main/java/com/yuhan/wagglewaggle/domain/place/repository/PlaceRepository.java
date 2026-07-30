package com.yuhan.wagglewaggle.domain.place.repository;

import com.yuhan.wagglewaggle.domain.place.entity.Place;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface PlaceRepository extends JpaRepository<Place, Long> {

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
