package com.yuhan.wagglewaggle.domain.category.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 회원이 선택한 선호 카테고리(회원-카테고리 연결). (member_id, category_id) 복합 UNIQUE.
 * 단순 연결 테이블이므로 감사 컬럼(BaseEntity)은 두지 않는다. member_id/category_id는 raw FK 값이다.
 */
@Getter
@Entity
@Table(
        name = "category_preferences",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_category_preference_member_category",
                columnNames = {"member_id", "category_id"}
        )
)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CategoryPreference {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "member_id", nullable = false)
    private Long memberId;

    @Column(name = "category_id", nullable = false)
    private Long categoryId;

    private CategoryPreference(Long memberId, Long categoryId) {
        this.memberId = memberId;
        this.categoryId = categoryId;
    }

    public static CategoryPreference create(Long memberId, Long categoryId) {
        return new CategoryPreference(memberId, categoryId);
    }
}
