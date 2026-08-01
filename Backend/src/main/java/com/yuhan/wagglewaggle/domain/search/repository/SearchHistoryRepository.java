package com.yuhan.wagglewaggle.domain.search.repository;

import com.yuhan.wagglewaggle.domain.search.entity.SearchHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface SearchHistoryRepository extends JpaRepository<SearchHistory, Long> {

    /**
     * 특정 회원의 최근 검색기록을 (search_type, keyword) 기준으로 중복 제거하여 최신순으로 조회한다.
     * PostgreSQL DISTINCT ON으로 조합별 최신 1건만 남긴 뒤 created_at 내림차순으로 정렬하고 limit만큼 반환한다.
     * placeId, kakaoPlaceId는 엔티티 컬럼값을 그대로 사용하며(TAG 검색이면 둘 다 null), place는 LAZY이지만
     * 서비스에서 id만 접근하므로 추가 조회가 발생하지 않는다.
     */
    @Query(value = """
            SELECT * FROM (
                SELECT DISTINCT ON (sh.search_type, sh.keyword) sh.*
                FROM search_histories sh
                WHERE sh.member_id = :memberId
                ORDER BY sh.search_type, sh.keyword, sh.created_at DESC
            ) dedup
            ORDER BY dedup.created_at DESC
            LIMIT :limit
            """, nativeQuery = true)
    List<SearchHistory> findRecentDistinctByMember(
            @Param("memberId") Long memberId,
            @Param("limit") int limit
    );
}
