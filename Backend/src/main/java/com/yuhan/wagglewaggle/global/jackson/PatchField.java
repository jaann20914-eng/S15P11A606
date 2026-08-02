package com.yuhan.wagglewaggle.global.jackson;

import java.util.Objects;

/**
 * PATCH 요청에서 "필드 생략"과 "명시적 null"을 구분하기 위한 3상태(tri-state) 값이다.
 *
 * <ul>
 *   <li>absent : JSON에 키 자체가 없음 → 기존 값 유지</li>
 *   <li>present + null : {@code "field": null} → 기존 값 삭제(허용되는 필드에 한함)</li>
 *   <li>present + value : {@code "field": value} → 값으로 변경</li>
 * </ul>
 *
 * 일반 nullable 타입만으로는 생략과 null을 구분할 수 없어, 별도 라이브러리 추가 없이
 * Jackson 기본 기능({@link PatchFieldDeserializer})만으로 이 구분을 지원한다.
 */
public final class PatchField<T> {

    private static final PatchField<?> ABSENT = new PatchField<>(false, null);

    // JSON에 키가 존재했는지 여부. 값이 null이어도 키가 있으면 true.
    private final boolean present;
    // present일 때의 값. 명시적 null이면 present=true, value=null이다.
    private final T value;

    private PatchField(boolean present, T value) {
        this.present = present;
        this.value = value;
    }

    /** 키가 생략된 상태(기존 값 유지). */
    @SuppressWarnings("unchecked")
    public static <T> PatchField<T> absent() {
        return (PatchField<T>) ABSENT;
    }

    /** 키가 존재하고 값이 있는 상태(값으로 변경). */
    public static <T> PatchField<T> of(T value) {
        return new PatchField<>(true, value);
    }

    /** 키가 존재하고 값이 명시적 null인 상태(기존 값 삭제). */
    public static <T> PatchField<T> ofNull() {
        return new PatchField<>(true, null);
    }

    /** 키가 존재했는가(값이 null이어도 true). 요청에 포함된 "수정 대상" 필드인지 판정에 사용한다. */
    public boolean isPresent() {
        return present;
    }

    /** 키가 생략되었는가. */
    public boolean isAbsent() {
        return !present;
    }

    /** 키가 존재하고 값이 명시적 null인가(삭제 의도). */
    public boolean isExplicitNull() {
        return present && value == null;
    }

    /** 키가 존재하고 실제 값이 있는가. */
    public boolean hasValue() {
        return present && value != null;
    }

    /** present일 때의 값(absent거나 명시적 null이면 null). */
    public T value() {
        return value;
    }

    /** 생략되었으면 fallback, 아니면 현재 값(명시적 null 포함)을 반환한다. */
    public T orElse(T fallback) {
        return present ? value : fallback;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof PatchField<?> other)) {
            return false;
        }
        return present == other.present && Objects.equals(value, other.value);
    }

    @Override
    public int hashCode() {
        return Objects.hash(present, value);
    }

    @Override
    public String toString() {
        if (!present) {
            return "PatchField.absent";
        }
        return "PatchField[" + value + "]";
    }
}
