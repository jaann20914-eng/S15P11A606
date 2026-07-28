package com.yuhan.wagglewaggle.domain.user.entity;

import com.yuhan.wagglewaggle.global.entity.BaseEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 정식 회원. 온보딩 완료 시점(별도 티켓)에만 생성된다.
 * 이번 OAuth 티켓에서는 생성하지 않고 존재 여부와 id만 사용한다.
 * nickname/age_group/gender/view_angle/credit_balance/deleted_at 등
 * 온보딩 컬럼과 관련 enum(AgeGroup/Gender)은 온보딩 티켓에서 추가한다.
 */
@Getter
@Entity
@Table(name = "members")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Member extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
}
