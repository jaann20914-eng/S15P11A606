package com.yuhan.wagglewaggle.domain.user.entity;

import com.yuhan.wagglewaggle.global.entity.BaseEntity;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
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

import java.math.BigDecimal;
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

    public static final BigDecimal INITIAL_VIEW_ANGLE = BigDecimal.valueOf(90);
    public static final BigDecimal MIN_VIEW_ANGLE = BigDecimal.valueOf(0);
    public static final BigDecimal MAX_VIEW_ANGLE = BigDecimal.valueOf(360);
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
    private BigDecimal viewAngle;

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

    /**
     * 닉네임을 변경한다. 호출부에서 형식 검증·소문자 정규화·중복 검사를 마친 값을 전달한다.
     * 단일 컬럼 UNIQUE(uq_member_nickname)는 저장 시점(flush)에 최종 보장된다.
     */
    public void updateNickname(String normalizedNickname) {
        this.nickname = normalizedNickname;
    }

    /**
     * 크레딧을 지급(양수)하거나 차감(음수)하고 갱신된 잔액을 반환한다.
     * 잔액은 0 미만이 될 수 없다(credit_balance CHECK 정합성 유지).
     */
    public int addCredit(int amount) {
        int next = this.creditBalance + amount;
        if (next < 0) {
            throw new IllegalStateException("크레딧 잔액은 0 미만이 될 수 없습니다.");
        }
        this.creditBalance = next;
        return this.creditBalance;
    }

    /**
     * 작성자 온도(view_angle)를 delta 만큼 변화시키고 갱신된 값을 반환한다.
     * 허용 범위(0~360)를 벗어나지 않도록 클램프한다(view_angle CHECK 정합성 유지).
     */
    public BigDecimal applyViewChange(BigDecimal delta) {
        BigDecimal next = this.viewAngle.add(delta);
        if (next.compareTo(MIN_VIEW_ANGLE) < 0) {
            next = MIN_VIEW_ANGLE;
        } else if (next.compareTo(MAX_VIEW_ANGLE) > 0) {
            next = MAX_VIEW_ANGLE;
        }
        this.viewAngle = next;
        return this.viewAngle;
    }

    /**
     * 크레딧을 차감한다. 잔액이 부족하면 {@code INSUFFICIENT_CREDIT}로 거래를 막는다.
     * 호출 전 행 잠금(findByIdForUpdate)으로 동시 변경을 직렬화해야 한다.
     */
    public void decreaseCredit(int amount) {
        if (this.creditBalance < amount) {
            throw new CustomException(ErrorCode.INSUFFICIENT_CREDIT);
        }
        this.creditBalance -= amount;
    }

    /**
     * 크레딧을 적립한다. 호출 전 행 잠금(findByIdForUpdate)으로 동시 변경을 직렬화해야 한다.
     */
    public void increaseCredit(int amount) {
        this.creditBalance += amount;
    }
}
