package com.yuhan.wagglewaggle.domain.place.repository;

import com.yuhan.wagglewaggle.domain.place.entity.Place;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
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

    /**
     * 추천 후보 장소 id를 반경(미터) 내에서 조회한다.
     * 후보 조건:
     * - 적용 위치로부터 radiusMeters 이내(PostGIS ST_DWithin, places.location 기준, 미터 단위)
     * - 카테고리가 ETC가 아님(AI는 6종만 허용하므로 ETC는 후보에서 제외)
     * - 현재 열람 가능한 핀이 1개 이상 존재(video_status=ACTIVE, 미삭제, 미만료)
     * ST_MakePoint 인자 순서는 (경도, 위도)이며, 4326으로 SRID를 지정한 뒤 geography로 캐스팅해
     * location(geography)과 미터 기준으로 비교한다.
     */
    @Query(value = """
            SELECT p.id FROM places p
            WHERE p.category::text <> 'ETC'
              AND ST_DWithin(
                    p.location,
                    ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
                    :radiusMeters)
              AND EXISTS (
                    SELECT 1 FROM pins pin
                    WHERE pin.place_id = p.id
                      AND pin.video_status = 'ACTIVE'
                      AND pin.deleted_at IS NULL
                      AND pin.expires_at > :now)
            """, nativeQuery = true)
    List<Long> findCandidatePlaceIds(
            @Param("lng") double lng,
            @Param("lat") double lat,
            @Param("radiusMeters") double radiusMeters,
            @Param("now") Instant now
    );
}
