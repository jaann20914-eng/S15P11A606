package com.yuhan.wagglewaggle.domain.search.entity;

import com.yuhan.wagglewaggle.domain.place.entity.Place;
import com.yuhan.wagglewaggle.domain.user.entity.Member;
import com.yuhan.wagglewaggle.global.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Entity
@Table(name = "search_histories")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SearchHistory extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    // KEYWORD/TAG 검색인 경우 place는 null이다.
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "place_id")
    private Place place;

    // 장소 검색인 경우 카카오 장소 ID를 남긴다(우리 DB에 없어 place가 null이어도 저장). TAG 검색이면 null이다.
    @Column(name = "kakao_place_id", length = 200)
    private String kakaoPlaceId;

    @Enumerated(EnumType.STRING)
    @Column(name = "search_type", nullable = false)
    private SearchType searchType;

    @Column(name = "keyword", length = 200)
    private String keyword;

    private SearchHistory(Member member, Place place, String kakaoPlaceId, SearchType searchType, String keyword) {
        this.member = member;
        this.place = place;
        this.kakaoPlaceId = kakaoPlaceId;
        this.searchType = searchType;
        this.keyword = keyword;
    }

    public static SearchHistory create(
            Member member, Place place, String kakaoPlaceId, SearchType searchType, String keyword) {
        return new SearchHistory(member, place, kakaoPlaceId, searchType, keyword);
    }
}
