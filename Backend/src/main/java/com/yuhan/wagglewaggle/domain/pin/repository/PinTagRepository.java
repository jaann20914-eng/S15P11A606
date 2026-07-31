package com.yuhan.wagglewaggle.domain.pin.repository;

import com.yuhan.wagglewaggle.domain.pin.entity.PinTag;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface PinTagRepository extends JpaRepository<PinTag, Long> {

    /**
     * 여러 핀의 태그를 한 번에 조회한다(핀별 N+1 방지). 서비스에서 pinId 기준으로 그룹핑해 사용한다.
     */
    List<PinTag> findByPin_IdIn(Collection<UUID> pinIds);
}
