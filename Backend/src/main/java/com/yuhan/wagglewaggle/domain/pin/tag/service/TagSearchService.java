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
            // 자음만으로 이루어진 질의는 초성 검색으로, 그 외는 일반(정확/접두/부분/오탈자) 검색으로 분기한다.
            NativeQuery query = hangulDecomposer.isChosungQuery(keyword)
                    ? buildChosungQuery(keyword, southWestLatitude, southWestLongitude, northEastLatitude, northEastLongitude)
                    : buildQuery(keyword, southWestLatitude, southWestLongitude, northEastLatitude, northEastLongitude);
            SearchHits<PinTagDocument> hits = operations.search(query, PinTagDocument.class);

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

    private NativeQuery buildQuery(
            String keyword,
            double southWestLatitude, double southWestLongitude,
            double northEastLatitude, double northEastLongitude) {
        String now = Instant.now().toString();
        // 검색어를 색인 side와 동일한 규칙으로 자모 분해해 오탈자 티어에 사용한다.
        String jamoKeyword = hangulDecomposer.decomposeToJamo(keyword);
        return NativeQuery.builder()
                .withQuery(q -> q.bool(b -> applyCandidateFilters(b,
                        southWestLatitude, southWestLongitude, northEastLatitude, northEastLongitude, now)
                        // 티어별 고정 점수: 완전일치 > 접두어 > 부분일치 > 오탈자
                        .should(s -> s.constantScore(cs -> cs
                                .filter(f -> f.term(t -> t.field("tag").value(keyword)))
                                .boost(EXACT_BOOST)))
                        .should(s -> s.constantScore(cs -> cs
                                .filter(f -> f.match(m -> m.field("tag.prefix").query(keyword)))
                                .boost(PREFIX_BOOST)))
                        .should(s -> s.constantScore(cs -> cs
                                .filter(f -> f.match(m -> m.field("tag.ngram").query(keyword)))
                                .boost(PARTIAL_BOOST)))
                        // 오탈자: 자모 2-gram이 과반 이상 겹치면 매칭("카패" -> 카페). 최하위 우선순위.
                        .should(s -> s.constantScore(cs -> cs
                                .filter(f -> f.match(m -> m.field("tagJamo").query(jamoKeyword)
                                        .minimumShouldMatch(JAMO_MIN_SHOULD_MATCH)))
                                .boost(JAMO_BOOST)))
                        .minimumShouldMatch("1")))
                .withFieldCollapse(FieldCollapse.of(fc -> fc.field("tag")))
                .withPageable(PageRequest.of(0, MAX_RESULTS))
                .build();
    }

    // 초성 전용 질의("ㅋㅍ") 전용 쿼리. 초성 문자열 필드에서 완전일치 > 접두어 > 부분일치로 매칭한다.
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
