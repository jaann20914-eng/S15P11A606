package com.yuhan.wagglewaggle.domain.pin.repository;

import com.yuhan.wagglewaggle.domain.pin.entity.PinUnlock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface PinUnlockRepository extends JpaRepository<PinUnlock, Long> {

    /**
     * 인증 사용자가 열람(unlock)한 핀 id만 한 번에 조회한다(핀별 N+1 방지).
     * 엔티티를 로딩하지 않고 pin_id만 SELECT 하며, 결과는 서비스에서 Set으로 만들어 isUnlocked 판정에 사용한다.
     */
    @Query("""
            SELECT pu.pin.id FROM PinUnlock pu
            WHERE pu.member.id = :memberId
              AND pu.pin.id IN :pinIds
            """)
    List<UUID> findUnlockedPinIds(
            @Param("memberId") Long memberId,
            @Param("pinIds") Collection<UUID> pinIds
    );

    /**
     * 특정 회원이 해당 핀의 결제 완료 열람 권한(PinUnlock)을 가졌는지 검사한다(핀 상세 접근 수준 판정용).
     * PinUnlock에는 별도 결제 상태 컬럼이 없고 (pin_id, member_id) 유니크 제약이 있어,
     * 행의 존재 자체가 결제 완료 열람을 의미한다.
     */
    boolean existsByPin_IdAndMember_Id(UUID pinId, Long memberId);
}
