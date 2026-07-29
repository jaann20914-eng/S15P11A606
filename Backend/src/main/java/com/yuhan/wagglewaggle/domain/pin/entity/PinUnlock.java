package com.yuhan.wagglewaggle.domain.pin.entity;

import com.yuhan.wagglewaggle.domain.user.entity.Member;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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

import java.util.UUID;

@Getter
@Entity
@Table(
        name = "pin_unlocks",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_pin_unlocks_pin_id_member_id",
                        columnNames = {"pin_id", "member_id"}
                ),
                @UniqueConstraint(
                        name = "uk_pin_unlocks_idempotency_key",
                        columnNames = {"idempotency_key"}
                )
        }
)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PinUnlock {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pin_id", nullable = false)
    private Pin pin;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @Column(name = "idempotency_key", nullable = false)
    private UUID idempotencyKey;

    private PinUnlock(Pin pin, Member member, UUID idempotencyKey) {
        this.pin = pin;
        this.member = member;
        this.idempotencyKey = idempotencyKey;
    }

    public static PinUnlock create(Pin pin, Member member, UUID idempotencyKey) {
        return new PinUnlock(pin, member, idempotencyKey);
    }
}
