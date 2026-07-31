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

import java.time.Duration;
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

    // ACTIVE 전환 시 노출 유효 기간. 만료 시각은 전환(처리) 시각 기준 1시간 뒤로 설정한다.
    private static final Duration ACTIVE_VIDEO_TTL = Duration.ofHours(1);

    /**
     * AI 블러·검수 결과가 PASS이고 얼굴 블러 영상·썸네일이 정상 반영되면 핀을 공개(ACTIVE) 상태로 전환한다.
     * expiresAt은 이 전환을 처리하는 Back 서버 시각(processedAt) 기준 1시간 뒤로 설정한다.
     */
    public void activate(String blurredVideoKey, String thumbnailKey, Instant processedAt) {
        this.videoStatus = VideoStatus.ACTIVE;
        this.blurredVideoKey = blurredVideoKey;
        this.thumbnailKey = thumbnailKey;
        this.expiresAt = processedAt.plus(ACTIVE_VIDEO_TTL);
    }

    /**
     * AI 검수 결과가 FAIL인 경우. 핀을 공개하지 않으며(REJECTED) expiresAt은 설정하지 않는다.
     */
    public void reject() {
        this.videoStatus = VideoStatus.REJECTED;
    }

    /**
     * 시스템 처리 결과가 FAILED인 경우. 핀을 공개하지 않으며(FAILED) expiresAt은 설정하지 않는다.
     */
    public void markFailed() {
        this.videoStatus = VideoStatus.FAILED;
    }
}
