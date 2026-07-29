package com.yuhan.wagglewaggle.domain.pin.entity;

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

@Getter
@Entity
@Table(
        name = "pin_tags",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_pin_tags_pin_id_tag",
                columnNames = {"pin_id", "tag"}
        )
)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PinTag {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pin_id", nullable = false)
    private Pin pin;

    @Column(name = "tag", nullable = false, length = 30)
    private String tag;

    private PinTag(Pin pin, String tag) {
        this.pin = pin;
        this.tag = tag;
    }

    public static PinTag create(Pin pin, String tag) {
        return new PinTag(pin, tag);
    }
}
