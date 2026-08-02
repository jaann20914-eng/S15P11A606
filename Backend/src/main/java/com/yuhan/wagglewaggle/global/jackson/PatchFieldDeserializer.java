package com.yuhan.wagglewaggle.global.jackson;

import tools.jackson.core.JacksonException;
import tools.jackson.core.JsonParser;
import tools.jackson.databind.BeanProperty;
import tools.jackson.databind.DeserializationContext;
import tools.jackson.databind.JavaType;
import tools.jackson.databind.ValueDeserializer;

/**
 * {@link PatchField} 전용 Jackson 디시리얼라이저(Jackson 3, {@code tools.jackson}).
 *
 * <p>Jackson은 JSON에 키가 존재할 때만 디시리얼라이저를 호출한다.</p>
 * <ul>
 *   <li>키 생략 → 이 디시리얼라이저가 호출되지 않고, DTO 필드의 초기값
 *       {@code PatchField.absent()}가 그대로 유지된다.</li>
 *   <li>키가 있고 값이 null → {@link #getNullValue}가 호출되어 {@code PatchField.ofNull()} 반환.</li>
 *   <li>키가 있고 값이 있음 → {@link #deserialize}가 호출되어 {@code PatchField.of(value)} 반환.</li>
 * </ul>
 *
 * {@link #createContextual}로 감싼 제네릭 타입 T를 파악해 내부 값을 정확히 역직렬화한다.
 */
public class PatchFieldDeserializer extends ValueDeserializer<PatchField<?>> {

    // PatchField<T>의 T 타입. createContextual에서 채워진다.
    private final JavaType containedType;

    public PatchFieldDeserializer() {
        this.containedType = null;
    }

    private PatchFieldDeserializer(JavaType containedType) {
        this.containedType = containedType;
    }

    @Override
    public ValueDeserializer<?> createContextual(DeserializationContext ctxt, BeanProperty property) {
        JavaType wrapperType = property != null ? property.getType() : null;
        JavaType contained = (wrapperType != null && wrapperType.containedTypeCount() > 0)
                ? wrapperType.containedType(0)
                : ctxt.constructType(Object.class);
        return new PatchFieldDeserializer(contained);
    }

    @Override
    public PatchField<?> deserialize(JsonParser p, DeserializationContext ctxt) throws JacksonException {
        Object value = ctxt.readValue(p, containedType);
        return PatchField.of(value);
    }

    /** JSON 값이 명시적 null일 때 호출된다. absent(키 생략)와 구분되는 "삭제 의도" 상태를 만든다. */
    @Override
    public Object getNullValue(DeserializationContext ctxt) {
        return PatchField.ofNull();
    }
}
