package com.yuhan.wagglewaggle.domain.view.entity;

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

import java.math.BigDecimal;
import java.util.UUID;

/**
 * 온도(view_angle) 적립·차감 이력. member_id는 raw FK 값으로 보관한다(양방향 연관관계 미사용).
 * pin_id는 핀 참조용 raw FK 값으로 보관하며(pins FK 존재), 핀과 무관한 변동은 null이다.
 */
@Getter
@Entity
@Table(name = "view_transactions")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ViewTransaction extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "member_id", nullable = false)
    private Long memberId;

    @Column(name = "pin_id")
    private UUID pinId;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false)
    private ViewTransactionType type;

    @Column(name = "change_amount", nullable = false)
    private BigDecimal changeAmount;

    @Column(name = "view_after", nullable = false)
    private BigDecimal viewAfter;

    private ViewTransaction(Long memberId, ViewTransactionType type, UUID pinId,
                            BigDecimal changeAmount, BigDecimal viewAfter) {
        this.memberId = memberId;
        this.type = type;
        this.pinId = pinId;
        this.changeAmount = changeAmount;
        this.viewAfter = viewAfter;
    }

    public static ViewTransaction create(Long memberId, ViewTransactionType type, UUID pinId,
                                         BigDecimal changeAmount, BigDecimal viewAfter) {
        return new ViewTransaction(memberId, type, pinId, changeAmount, viewAfter);
    }
}
