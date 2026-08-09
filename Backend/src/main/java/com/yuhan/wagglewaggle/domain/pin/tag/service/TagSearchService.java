package com.yuhan.wagglewaggle.domain.pin.tag.service;

import com.yuhan.wagglewaggle.domain.pin.tag.document.PinTagDocument;
import com.yuhan.wagglewaggle.domain.pin.tag.dto.TagSearchResponse;
import com.yuhan.wagglewaggle.domain.pin.tag.dto.TagSearchResult;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import co.elastic.clients.elasticsearch._types.query_dsl.BoolQuery;
import co.elastic.clients.elasticsearch.core.search.FieldCollapse;
import co.elastic.clients.json.JsonData;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.elasticsearch.client.elc.NativeQuery;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.data.elasticsearch.core.SearchHits;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
@Slf4j
@RequiredArgsConstructor
public class TagSearchService {

    private static final int MAX_RESULTS = 10;

    // constant_score로 각 관점의 점수를 고정해 완전일치 > 접두어 > 부분일치 > 오탈자 순서를 보장한다.
    // (일반 match는 TF/IDF로 점수가 흔들려 티어 역전이 가능하므로 constant_score를 쓴다.)
    // 여러 티어가 동시에 맞아도 순서가 뒤집히지 않도록 boost를 자릿수로 벌린다.
    private static final float EXACT_BOOST = 1000.0f;
    private static final float PREFIX_BOOST = 100.0f;
    private static final float PARTIAL_BOOST = 10.0f;
    private static final float JAMO_BOOST = 1.0f;

    // 오탈자(자모) 티어는 자모 2-gram이 1개만 겹쳐도 매칭돼 오탐이 크다("부산" -> "조용한", "스타" -> "핫플레이스").
    // 질의 자모 토큰의 70% 이상이 겹칠 때만 통과시켜, 오탈자(대부분 겹침)는 살리고 우연한 1개 겹침 노이즈는 제거한다.
    // (50%는 3토큰 질의에서 1.5→내림 "1개"가 되어 무력하므로 70%로 둔다. 3토큰이면 2개, 4토큰이면 2개 이상 요구.)
    private static final String JAMO_MIN_SHOULD_MATCH = "70%";

    private final TagQueryNormalizer normalizer;
    private final HangulDecomposer hangulDecomposer;
    private final ElasticsearchOperations operations;

    public TagSearchResponse search(
            String q,
            double southWestLatitude, double southWestLongitude,
            double northEastLatitude, double northEastLongitude) {
        String keyword = normalizer.normalizeAndValidate(
                q, southWestLatitude, southWestLongitude, northEastLatitude, northEastLongitude);

        try {
            SearchHits<PinTagDocument> hits = searchHits(
                    keyword, southWestLatitude, southWestLongitude, northEastLatitude, northEastLongitude);

            List<TagSearchResult> tags = hits.getSearchHits().stream()
                    .map(hit -> new TagSearchResult(hit.getContent().getTag()))
                    .toList();

            return new TagSearchResponse(tags);
        } catch (CustomException e) {
            throw e;
        } catch (Exception e) {
            log.error("태그 검색 실패: {}", e.getMessage(), e);
            throw new CustomException(ErrorCode.TAG_SEARCH_FAILED);
        }
    }

    // 일반 검색: 정확/접두/부분(음절)로 먼저 찾고, 결과가 하나도 없을 때만 오탈자(자모) fallback을 돈다.
    // 오탈자 티어를 항상 섞으면 "삼겹"에 "삼계탕"처럼 자모가 우연히 겹치는 무관한 태그가 딸려오므로,
    // "정타로는 아무것도 안 잡힐 때"만 오탈자 보정을 동작시킨다.
    private SearchHits<PinTagDocument> searchHits(
            String keyword,
            double southWestLatitude, double southWestLongitude,
            double northEastLatitude, double northEastLongitude) {
        if (hangulDecomposer.isChosungQuery(keyword)) {
            return operations.search(
                    buildChosungQuery(keyword, southWestLatitude, southWestLongitude, northEastLatitude, northEastLongitude),
                    PinTagDocument.class);
        }
        SearchHits<PinTagDocument> strict = operations.search(
                buildStrictQuery(keyword, southWestLatitude, southWestLongitude, northEastLatitude, northEastLongitude),
                PinTagDocument.class);
        if (!strict.getSearchHits().isEmpty()) {
            return strict;
        }
        return operations.search(
                buildJamoFallbackQuery(keyword, southWestLatitude, southWestLongitude, northEastLatitude, northEastLongitude),
                PinTagDocument.class);
    }

    // 일반 검색 1차: 완전일치 > 접두어 > 부분일치(음절 기반). 오탈자(자모)는 포함하지 않는다.
    private NativeQuery buildStrictQuery(
            String keyword,
            double southWestLatitude, double southWestLongitude,
            double northEastLatitude, double northEastLongitude) {
        String now = Instant.now().toString();
        return NativeQuery.builder()
                .withQuery(q -> q.bool(b -> applyCandidateFilters(b,
                        southWestLatitude, southWestLongitude, northEastLatitude, northEastLongitude, now)
                        // 티어별 고정 점수: 완전일치 > 접두어 > 부분일치
                        .should(s -> s.constantScore(cs -> cs
                                .filter(f -> f.term(t -> t.field("tag").value(keyword)))
                                .boost(EXACT_BOOST)))
                        .should(s -> s.constantScore(cs -> cs
                                .filter(f -> f.match(m -> m.field("tag.prefix").query(keyword)))
                                .boost(PREFIX_BOOST)))
                        .should(s -> s.constantScore(cs -> cs
                                .filter(f -> f.match(m -> m.field("tag.ngram").query(keyword)))
                                .boost(PARTIAL_BOOST)))
                        .minimumShouldMatch("1")))
                .withFieldCollapse(FieldCollapse.of(fc -> fc.field("tag")))
                .withPageable(PageRequest.of(0, MAX_RESULTS))
                .build();
    }

    // 일반 검색 2차(fallback): 1차에서 결과가 없을 때만 오탈자(자모) 매칭을 돈다.
    // 검색어를 색인 side와 동일 규칙으로 자모 분해하고, 자모 2-gram의 70% 이상이 겹칠 때만 매칭한다("카패" -> 카페).
    private NativeQuery buildJamoFallbackQuery(
            String keyword,
            double southWestLatitude, double southWestLongitude,
            double northEastLatitude, double northEastLongitude) {
        String now = Instant.now().toString();
        String jamoKeyword = hangulDecomposer.decomposeToJamo(keyword);
        return NativeQuery.builder()
                .withQuery(q -> q.bool(b -> applyCandidateFilters(b,
                        southWestLatitude, southWestLongitude, northEastLatitude, northEastLongitude, now)
                        .should(s -> s.constantScore(cs -> cs
                                .filter(f -> f.match(m -> m.field("tagJamo").query(jamoKeyword)
                                        .minimumShouldMatch(JAMO_MIN_SHOULD_MATCH)))
                                .boost(JAMO_BOOST)))
                        .minimumShouldMatch("1")))
                .withFieldCollapse(FieldCollapse.of(fc -> fc.field("tag")))
                .withPageable(PageRequest.of(0, MAX_RESULTS))
                .build();
    }

    // 초성 전용 질의("ㅋㅍ") 전용 쿼리. 초성 문자열 필드에서 완전일치 > 접두어로 매칭한다.
    // (부분(ngram)일치는 "ㅅㄱㅅ"에 가성비·상견례·삼계탕처럼 무관한 초성이 딸려와 제외한다.)
    private NativeQuery buildChosungQuery(
            String keyword,
            double southWestLatitude, double southWestLongitude,
            double northEastLatitude, double northEastLongitude) {
        String now = Instant.now().toString();
        return NativeQuery.builder()
                .withQuery(q -> q.bool(b -> applyCandidateFilters(b,
                        southWestLatitude, southWestLongitude, northEastLatitude, northEastLongitude, now)
                        .should(s -> s.constantScore(cs -> cs
                                .filter(f -> f.term(t -> t.field("tagChosung").value(keyword)))
                                .boost(EXACT_BOOST)))
                        .should(s -> s.constantScore(cs -> cs
                                .filter(f -> f.match(m -> m.field("tagChosung.prefix").query(keyword)))
                                .boost(PREFIX_BOOST)))
                        .minimumShouldMatch("1")))
                .withFieldCollapse(FieldCollapse.of(fc -> fc.field("tag")))
                .withPageable(PageRequest.of(0, MAX_RESULTS))
                .build();
    }

    // 지도 경계(bounds) + 활성 + 미만료만 후보로 통과시킨다(일반/초성 모드 공통).
    private BoolQuery.Builder applyCandidateFilters(
            BoolQuery.Builder b,
            double southWestLatitude, double southWestLongitude,
            double northEastLatitude, double northEastLongitude,
            String now) {
        return b
                .filter(f -> f.geoBoundingBox(g -> g
                        .field("location")
                        .boundingBox(bb -> bb.tlbr(t -> t
                                .topLeft(tl -> tl.latlon(ll -> ll.lat(northEastLatitude).lon(southWestLongitude)))
                                .bottomRight(br -> br.latlon(ll -> ll.lat(southWestLatitude).lon(northEastLongitude)))))))
                .filter(f -> f.term(t -> t.field("active").value(true)))
                .filter(f -> f.range(r -> r.untyped(u -> u.field("expiresAt").gt(JsonData.of(now)))));
    }
}
