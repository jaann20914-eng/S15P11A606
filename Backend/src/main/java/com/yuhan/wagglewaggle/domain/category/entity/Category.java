package com.yuhan.wagglewaggle.domain.category.entity;

import com.yuhan.wagglewaggle.global.entity.BaseEntity;
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
 * 선호 카테고리 기준 정보(시드 데이터). API 요청은 code(예: CAFE)로 전달되며,
 * code로 조회한 뒤 category_preferences.category_id 로 저장한다.
 */
@Getter
@Entity
@Table(
        name = "categories",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_category_code",
                columnNames = {"code"}
        )
)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Category extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "name", nullable = false, length = 50)
    private String name;

    @Column(name = "code", nullable = false, length = 50)
    private String code;
}
