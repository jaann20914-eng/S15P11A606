package com.yuhan.wagglewaggle.domain.pin.tag.service;

import com.yuhan.wagglewaggle.domain.pin.tag.document.PinTagDocument;
import com.yuhan.wagglewaggle.domain.pin.tag.dto.TagSearchResponse;
import com.yuhan.wagglewaggle.domain.pin.tag.dto.TagSearchResult;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
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

    // constant_score로 각 관점의 점수를 고정해 완전일치 > 접두어 > 부분일치 순서를 보장한다.
    // (일반 match는 TF/IDF로 점수가 흔들려 티어 역전이 가능하므로 constant_score를 쓴다.)
    private static final float EXACT_BOOST = 100.0f;
    private static final float PREFIX_BOOST = 10.0f;
    private static final float PARTIAL_BOOST = 1.0f;

    private final TagQueryNormalizer normalizer;
    private final ElasticsearchOperations operations;

    public TagSearchResponse search(
            String q,
            double southWestLatitude, double southWestLongitude,
            double northEastLatitude, double northEastLongitude) {
        String keyword = normalizer.normalizeAndValidate(
                q, southWestLatitude, southWestLongitude, northEastLatitude, northEastLongitude);

        try {
            NativeQuery query = buildQuery(
                    keyword, southWestLatitude, southWestLongitude, northEastLatitude, northEastLongitude);
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
        return NativeQuery.builder()
                .withQuery(q -> q.bool(b -> b
                        // 지도 경계(bounds) + 활성 + 미만료만 후보로 통과
                        .filter(f -> f.geoBoundingBox(g -> g
                                .field("location")
                                .boundingBox(bb -> bb.tlbr(t -> t
                                        .topLeft(tl -> tl.latlon(ll -> ll.lat(northEastLatitude).lon(southWestLongitude)))
                                        .bottomRight(br -> br.latlon(ll -> ll.lat(southWestLatitude).lon(northEastLongitude)))))))
                        .filter(f -> f.term(t -> t.field("active").value(true)))
                        .filter(f -> f.range(r -> r.untyped(u -> u.field("expiresAt").gt(JsonData.of(now)))))
                        // 티어별 고정 점수: 완전일치(100) > 접두어(10) > 부분일치(1)
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
}
