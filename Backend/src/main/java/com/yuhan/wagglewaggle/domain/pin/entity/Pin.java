package com.yuhan.wagglewaggle.domain.pin.entity;

import com.yuhan.wagglewaggle.domain.place.entity.Place;
import com.yuhan.wagglewaggle.domain.user.entity.Member;
import com.yuhan.wagglewaggle.global.entity.BaseEntity;
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
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.locationtech.jts.geom.Point;

import java.time.Instant;
import java.util.UUID;

@Getter
@Entity
@Table(name = "pins")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Pin extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "place_id", nullable = false)
    private Place place;

    @Enumerated(EnumType.STRING)
    @Column(name = "publisher_status", nullable = false)
    private PublisherStatus publisherStatus = PublisherStatus.STILL_HERE;

    @Enumerated(EnumType.STRING)
    @Column(name = "video_status", nullable = false)
    private VideoStatus videoStatus = VideoStatus.PENDING;

    @Enumerated(EnumType.STRING)
    @Column(name = "crowd_level", nullable = false)
    private CrowdLevel crowdLevel;

    @Column(name = "capture_location", columnDefinition = "geography(Point,4326)", nullable = false)
    private Point captureLocation;

    @Column(name = "detail_location", length = 200)
    private String detailLocation;

    @Column(name = "memo", length = 500)
    private String memo;

    @Column(name = "original_video_key", nullable = false, length = 1024)
    private String originalVideoKey;

    @Column(name = "blurred_video_key", length = 1024)
    private String blurredVideoKey;

    @Column(name = "thumbnail_key", length = 1024)
    private String thumbnailKey;

    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    private Pin(Member member, Place place, CrowdLevel crowdLevel, Point captureLocation,
                String detailLocation, String memo, String originalVideoKey, Instant expiresAt) {
        this.member = member;
        this.place = place;
        this.crowdLevel = crowdLevel;
        this.captureLocation = captureLocation;
        this.detailLocation = detailLocation;
        this.memo = memo;
        this.originalVideoKey = originalVideoKey;
        this.expiresAt = expiresAt;
    }

    public static Pin create(Member member, Place place, CrowdLevel crowdLevel, Point captureLocation,
                             String detailLocation, String memo, String originalVideoKey, Instant expiresAt) {
        return new Pin(member, place, crowdLevel, captureLocation,
                detailLocation, memo, originalVideoKey, expiresAt);
    }
}
