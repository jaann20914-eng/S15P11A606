package com.yuhan.wagglewaggle.domain.credit.entity;

import com.yuhan.wagglewaggle.global.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 크레딧 적립·차감 이력. member_id는 raw FK 값으로 보관한다(양방향 연관관계 미사용).
 * reference_id는 거래 유형별 참조 대상 식별자로 무결성 제약은 두지 않는다.
 */
@Getter
@Entity
@Table(name = "credit_transactions")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CreditTransaction extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "member_id", nullable = false)
    private Long memberId;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false)
    private CreditTransactionType type;

    @Column(name = "reference_id")
    private Long referenceId;

    @Column(name = "change_amount", nullable = false)
    private int changeAmount;

    @Column(name = "balance_after", nullable = false)
    private int balanceAfter;

    private CreditTransaction(Long memberId, CreditTransactionType type, Long referenceId,
                             int changeAmount, int balanceAfter) {
        this.memberId = memberId;
        this.type = type;
        this.referenceId = referenceId;
        this.changeAmount = changeAmount;
        this.balanceAfter = balanceAfter;
    }

    public static CreditTransaction create(Long memberId, CreditTransactionType type, Long referenceId,
                                           int changeAmount, int balanceAfter) {
        return new CreditTransaction(memberId, type, referenceId, changeAmount, balanceAfter);
    }
}
