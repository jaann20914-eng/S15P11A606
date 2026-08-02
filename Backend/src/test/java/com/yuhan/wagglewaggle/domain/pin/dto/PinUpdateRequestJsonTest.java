package com.yuhan.wagglewaggle.domain.pin.dto;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * PATCH 요청의 "필드 생략"과 "명시적 null"이 역직렬화 단계에서 구분되는지 검증한다.
 * 별도 라이브러리 없이 Jackson 기본 기능(PatchField + 커스텀 디시리얼라이저)만 사용한다.
 * Spring(부트 4)의 HTTP 계층과 동일한 Jackson 3(tools.jackson) 매퍼로 검증한다.
 */
class PinUpdateRequestJsonTest {

    private final JsonMapper objectMapper = JsonMapper.builder().build();

    private PinUpdateRequest read(String json) {
        return objectMapper.readValue(json, PinUpdateRequest.class);
    }

    @Test
    void 빈_객체면_모든_필드가_absent다() throws Exception {
        PinUpdateRequest request = read("{}");

        assertThat(request.hasAnyField()).isFalse();
        assertThat(request.memo().isAbsent()).isTrue();
        assertThat(request.detailLocation().isAbsent()).isTrue();
        assertThat(request.tags().isAbsent()).isTrue();
    }

    @Test
    void 필드_생략과_명시적_null이_구분된다() throws Exception {
        // memo는 명시적 null(삭제 의도), detailLocation은 생략(유지)
        PinUpdateRequest request = read("{\"memo\": null}");

        assertThat(request.memo().isPresent()).isTrue();
        assertThat(request.memo().isExplicitNull()).isTrue();
        assertThat(request.memo().hasValue()).isFalse();

        assertThat(request.detailLocation().isAbsent()).isTrue();
        assertThat(request.hasAnyField()).isTrue();
    }

    @Test
    void 값이_있으면_hasValue이고_값을_담는다() throws Exception {
        PinUpdateRequest request = read("{\"detailLocation\": \"2층 창가\"}");

        assertThat(request.detailLocation().hasValue()).isTrue();
        assertThat(request.detailLocation().value()).isEqualTo("2층 창가");
    }

    @Test
    void tags_생략과_빈_배열이_구분된다() throws Exception {
        assertThat(read("{}").tags().isAbsent()).isTrue();

        PinUpdateRequest emptyTags = read("{\"tags\": []}");
        assertThat(emptyTags.tags().isPresent()).isTrue();
        assertThat(emptyTags.tags().value()).isEmpty();
    }

    @Test
    void tags_값이_있으면_리스트로_역직렬화된다() throws Exception {
        PinUpdateRequest request = read("{\"tags\": [\"카페\", \"조용함\"]}");

        assertThat(request.tags().hasValue()).isTrue();
        assertThat(request.tags().value()).containsExactly("카페", "조용함");
    }

    @Test
    void 좌표와_placeId_숫자_필드도_구분된다() throws Exception {
        PinUpdateRequest request = read("{\"placeId\": 7, \"latitude\": 37.5, \"longitude\": 127.03}");

        assertThat(request.placeId().value()).isEqualTo(7L);
        assertThat(request.latitude().value()).isEqualTo(37.5);
        assertThat(request.longitude().value()).isEqualTo(127.03);
        assertThat(request.memo().isAbsent()).isTrue();
    }
}
