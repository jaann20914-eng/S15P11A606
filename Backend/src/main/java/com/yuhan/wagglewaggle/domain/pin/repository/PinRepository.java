package com.yuhan.wagglewaggle.domain.pin.repository;

import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;

public interface PinRepository extends JpaRepository<Pin, Long> {

    /**
     * 지정한 장소들의 유효 핀을 한 번에 조회한다.
     * 유효 = createdAt이 from 이후(최근 1시간 이내) AND (expiresAt이 없거나 아직 만료되지 않음).
     * 작성자 뷰 각도(member.viewAngle) 사용을 위해 member를 fetch join 하여 N+1을 방지한다.
     */
    @Query("""
            SELECT p FROM Pin p
            JOIN FETCH p.member
            WHERE p.place.id IN :placeIds
              AND p.createdAt >= :from
              AND (p.expiresAt IS NULL OR p.expiresAt > :now)
            """)
    List<Pin> findValidPins(
            @Param("placeIds") Collection<Long> placeIds,
            @Param("from") Instant from,
            @Param("now") Instant now
    );
}
