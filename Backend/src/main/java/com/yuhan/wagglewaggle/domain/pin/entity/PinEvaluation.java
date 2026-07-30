package com.yuhan.wagglewaggle.domain.pin.entity;

import com.yuhan.wagglewaggle.domain.user.entity.Member;
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
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Entity
@Table(
        name = "pin_evaluations",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_pin_evaluations_pin_id_member_id",
                columnNames = {"pin_id", "member_id"}
        )
)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PinEvaluation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pin_id", nullable = false)
    private Pin pin;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @Enumerated(EnumType.STRING)
    @Column(name = "evaluation", nullable = false)
    private PinEvaluationType evaluation;

    private PinEvaluation(Pin pin, Member member, PinEvaluationType evaluation) {
        this.pin = pin;
        this.member = member;
        this.evaluation = evaluation;
    }

    public static PinEvaluation create(Pin pin, Member member, PinEvaluationType evaluation) {
        return new PinEvaluation(pin, member, evaluation);
    }
}
