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
     * 영상 교체 PASS 결과를 반영한다. 기존 공개(ACTIVE) 상태를 유지한 채
     * 원본·블러·썸네일 키를 새 결과로 교체하고, 만료 시각을 반영 시각(processedAt) 기준 1시간 뒤로 갱신한다.
     * videoStatus는 ACTIVE로 유지한다(REJECTED·FAILED로 바꾸지 않는다).
     * processedAt은 메시지의 과거 시각이 아니라 Back이 결과를 정상 반영하는 서버 시각을 전달한다.
     */
    public void replaceVideo(String originalVideoKey, String blurredVideoKey,
                             String thumbnailKey, Instant processedAt) {
        this.originalVideoKey = originalVideoKey;
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

    // ===== 일반 정보 수정(PATCH) 반영 메서드 =====
    // 영상 관련 필드(originalVideoKey·blurredVideoKey·thumbnailKey·videoStatus·expiresAt)는
    // 이 메서드들로 바꾸지 않는다. 영상 교체는 AiBlurJob 접수 후 결과 반영 단계에서 처리한다.

    /** 최종 장소를 변경한다. */
    public void changePlace(Place place) {
        this.place = place;
    }

    /** 최종 촬영 좌표를 변경한다(geography Point, x=경도·y=위도). */
    public void changeCaptureLocation(Point captureLocation) {
        this.captureLocation = captureLocation;
    }

    /** 혼잡 단계를 변경한다. */
    public void changeCrowdLevel(CrowdLevel crowdLevel) {
        this.crowdLevel = crowdLevel;
    }

    /** 상세 위치를 변경한다. null이면 기존 값 삭제. */
    public void changeDetailLocation(String detailLocation) {
        this.detailLocation = detailLocation;
    }

    /** 메모를 변경한다. null이면 기존 값 삭제. */
    public void changeMemo(String memo) {
        this.memo = memo;
    }

    // ===== 소프트 삭제 =====

    /** 이미 삭제된 핀인지 여부. deleted_at이 기록되어 있으면 삭제된 것으로 본다. */
    public boolean isDeleted() {
        return this.deletedAt != null;
    }

    /**
     * 핀을 소프트 삭제한다(물리 삭제하지 않고 삭제 시각만 기록).
     * videoStatus·영상 키는 변경하지 않는다. 이미 삭제된 핀이면 최초 삭제 시각을 유지한다(멱등).
     */
    public void softDelete(Instant deletedAt) {
        if (this.deletedAt == null) {
            this.deletedAt = deletedAt;
        }
    }
}
