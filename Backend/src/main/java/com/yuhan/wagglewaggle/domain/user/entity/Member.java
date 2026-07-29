package com.yuhan.wagglewaggle.domain.user.entity;

import com.yuhan.wagglewaggle.global.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * 정식 회원. 온보딩 완료 시점에만 생성된다.
 * nickname은 소문자 정규화 후 저장하며 단일 컬럼 UNIQUE(uq_member_nickname)를 유지한다.
 * 온보딩 완료 여부는 별도 컬럼이 아니라 social_accounts.member_id 연결로 판단한다.
 */
@Getter
@Entity
@Table(
        name = "members",
        uniqueConstraints = @UniqueConstraint(
                name = "uq_member_nickname",
                columnNames = {"nickname"}
        )
)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Member extends BaseEntity {

    public static final int INITIAL_VIEW_ANGLE = 90;
    public static final int INITIAL_CREDIT_BALANCE = 10;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "nickname", nullable = false, length = 20)
    private String nickname;

    @Enumerated(EnumType.STRING)
    @Column(name = "age_group", nullable = false)
    private AgeGroup ageGroup;

    @Enumerated(EnumType.STRING)
    @Column(name = "gender", nullable = false)
    private Gender gender;

    @Column(name = "view_angle", nullable = false)
    private int viewAngle;

    @Column(name = "credit_balance", nullable = false)
    private int creditBalance;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    private Member(String nickname, AgeGroup ageGroup, Gender gender) {
        this.nickname = nickname;
        this.ageGroup = ageGroup;
        this.gender = gender;
        this.viewAngle = INITIAL_VIEW_ANGLE;
        this.creditBalance = INITIAL_CREDIT_BALANCE;
    }

    /**
     * 온보딩 완료 시 회원을 생성한다. 초기 view_angle=90, credit_balance=10 을 명시적으로 설정한다.
     * nickname은 호출부에서 소문자 정규화한 값을 전달한다.
     */
    public static Member create(String nickname, AgeGroup ageGroup, Gender gender) {
        return new Member(nickname, ageGroup, gender);
    }
}
