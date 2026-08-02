package com.yuhan.wagglewaggle.domain.pin.dto;

import com.fasterxml.jackson.annotation.JsonAutoDetect;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.yuhan.wagglewaggle.global.jackson.PatchField;
import com.yuhan.wagglewaggle.global.jackson.PatchFieldDeserializer;
import tools.jackson.databind.annotation.JsonDeserialize;

import java.util.List;

/**
 * 핀 수정(PATCH /api/v1/pins/{pinId}) 요청.
 *
 * <p>모든 필드는 선택이며, 검증은 서비스({@code PinUpdateValidator})에서 통일 처리한다.
 * 각 필드를 {@link PatchField}로 받아 "생략(기존 값 유지)"과 "명시적 null(기존 값 삭제)"을 구분한다.</p>
 *
 * <p>필드는 no-arg 생성 시 {@code PatchField.absent()}로 초기화되고, Jackson은 JSON에 존재하는
 * 키만 필드에 바인딩한다({@code fieldVisibility = ANY}). 따라서 생략된 필드는 absent로 남는다.</p>
 */
// creatorVisibility=NONE: 8-인자 생성자가 creator로 자동 선택되면 필드 초기값(absent)이 무시된다.
// no-arg 생성자로 인스턴스를 만들고 JSON에 존재하는 키만 필드에 주입하도록 강제한다.
@JsonAutoDetect(
        fieldVisibility = JsonAutoDetect.Visibility.ANY,
        creatorVisibility = JsonAutoDetect.Visibility.NONE)
@JsonIgnoreProperties(ignoreUnknown = true)
public final class PinUpdateRequest {

    @JsonDeserialize(using = PatchFieldDeserializer.class)
    private PatchField<String> originalVideoKey = PatchField.absent();

    @JsonDeserialize(using = PatchFieldDeserializer.class)
    private PatchField<Long> placeId = PatchField.absent();

    @JsonDeserialize(using = PatchFieldDeserializer.class)
    private PatchField<Double> latitude = PatchField.absent();

    @JsonDeserialize(using = PatchFieldDeserializer.class)
    private PatchField<Double> longitude = PatchField.absent();

    @JsonDeserialize(using = PatchFieldDeserializer.class)
    private PatchField<String> detailLocation = PatchField.absent();

    @JsonDeserialize(using = PatchFieldDeserializer.class)
    private PatchField<String> crowdLevel = PatchField.absent();

    @JsonDeserialize(using = PatchFieldDeserializer.class)
    private PatchField<String> memo = PatchField.absent();

    @JsonDeserialize(using = PatchFieldDeserializer.class)
    private PatchField<List<String>> tags = PatchField.absent();

    protected PinUpdateRequest() {
    }

    /**
     * 테스트·서비스에서 직접 조립할 때 쓰는 생성자. null 인자는 absent로 처리한다.
     * (Jackson은 no-arg 생성자와 필드 바인딩을 사용하므로 이 생성자를 타지 않는다.)
     */
    public PinUpdateRequest(
            PatchField<String> originalVideoKey,
            PatchField<Long> placeId,
            PatchField<Double> latitude,
            PatchField<Double> longitude,
            PatchField<String> detailLocation,
            PatchField<String> crowdLevel,
            PatchField<String> memo,
            PatchField<List<String>> tags
    ) {
        this.originalVideoKey = orAbsent(originalVideoKey);
        this.placeId = orAbsent(placeId);
        this.latitude = orAbsent(latitude);
        this.longitude = orAbsent(longitude);
        this.detailLocation = orAbsent(detailLocation);
        this.crowdLevel = orAbsent(crowdLevel);
        this.memo = orAbsent(memo);
        this.tags = orAbsent(tags);
    }

    private static <T> PatchField<T> orAbsent(PatchField<T> field) {
        return field != null ? field : PatchField.absent();
    }

    public PatchField<String> originalVideoKey() {
        return originalVideoKey;
    }

    public PatchField<Long> placeId() {
        return placeId;
    }

    public PatchField<Double> latitude() {
        return latitude;
    }

    public PatchField<Double> longitude() {
        return longitude;
    }

    public PatchField<String> detailLocation() {
        return detailLocation;
    }

    public PatchField<String> crowdLevel() {
        return crowdLevel;
    }

    public PatchField<String> memo() {
        return memo;
    }

    public PatchField<List<String>> tags() {
        return tags;
    }

    /** 수정 대상 필드가 하나라도 요청에 포함됐는지 여부(값이 null이어도 포함으로 본다). */
    public boolean hasAnyField() {
        return originalVideoKey.isPresent()
                || placeId.isPresent()
                || latitude.isPresent()
                || longitude.isPresent()
                || detailLocation.isPresent()
                || crowdLevel.isPresent()
                || memo.isPresent()
                || tags.isPresent();
    }
}
