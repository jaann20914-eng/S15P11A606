package com.yuhan.wagglewaggle.domain.pin.tag.service;

import com.yuhan.wagglewaggle.domain.pin.tag.document.PinTagDocument;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.elasticsearch.client.elc.NativeQuery;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.data.elasticsearch.core.SearchHit;
import org.springframework.data.elasticsearch.core.SearchHitsIterator;
import org.springframework.data.elasticsearch.core.document.Document;
import org.springframework.data.elasticsearch.core.mapping.IndexCoordinates;
import org.springframework.data.elasticsearch.core.query.FetchSourceFilterBuilder;
import org.springframework.data.elasticsearch.core.query.UpdateQuery;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 기존 pin-tags 문서에 자모/초성 필드를 채우는 <b>일회성 백필 러너</b>.
 *
 * <p>{@code pin-tags.backfill-on-startup=true} 일 때만 활성화된다(마이그레이션 배포 시 1회 실행 후 원복).
 * 아직 {@code tagChosung}이 없는(=백필되지 않은) 문서만 대상으로, 저장된 {@code tag}를
 * 색인/검색과 동일한 {@link HangulDecomposer}로 분해해 {@code tagJamo}/{@code tagChosung} 두 필드만
 * 부분 업데이트한다. 이미 채워진 문서는 건너뛰므로 재실행에도 멱등하다.</p>
 *
 * <p>{@code @Order(2)}로 매핑 병합 러너({@code pinTagsIndexRunner}, {@code @Order(1)}) 이후에 실행되도록 해,
 * 신규 필드가 매핑에 확정된 뒤 업데이트가 이뤄지도록 보장한다(동적 매핑으로 잘못된 타입이 굳는 것을 방지).</p>
 */
@Slf4j
@Component
@Order(2)
@RequiredArgsConstructor
@ConditionalOnProperty(name = "pin-tags.backfill-on-startup", havingValue = "true")
public class PinTagBackfillRunner implements ApplicationRunner {

    private static final int BATCH_SIZE = 500;

    private final ElasticsearchOperations operations;
    private final HangulDecomposer hangulDecomposer;

    @Override
    public void run(ApplicationArguments args) {
        IndexCoordinates index = operations.getIndexCoordinatesFor(PinTagDocument.class);
        // 아직 tagChosung이 없는 문서만 대상(이미 채워진 문서는 제외 → 멱등). tag만 로드해 불필요한 역직렬화를 피한다.
        NativeQuery query = NativeQuery.builder()
                .withQuery(q -> q.bool(b -> b.mustNot(mn -> mn.exists(e -> e.field("tagChosung")))))
                .withSourceFilter(new FetchSourceFilterBuilder().withIncludes("tag").build())
                .withPageable(PageRequest.of(0, BATCH_SIZE))
                .build();

        List<UpdateQuery> batch = new ArrayList<>();
        long total = 0;
        try (SearchHitsIterator<PinTagDocument> hits = operations.searchForStream(query, PinTagDocument.class)) {
            while (hits.hasNext()) {
                SearchHit<PinTagDocument> hit = hits.next();
                String tag = hit.getContent().getTag();
                if (tag == null || tag.isEmpty()) {
                    continue;
                }
                Map<String, Object> fields = new LinkedHashMap<>();
                fields.put("tagJamo", hangulDecomposer.decomposeToJamo(tag));
                fields.put("tagChosung", hangulDecomposer.extractChosung(tag));
                batch.add(UpdateQuery.builder(hit.getId()).withDocument(Document.from(fields)).build());
                if (batch.size() >= BATCH_SIZE) {
                    operations.bulkUpdate(batch, index);
                    total += batch.size();
                    batch.clear();
                }
            }
        }
        if (!batch.isEmpty()) {
            operations.bulkUpdate(batch, index);
            total += batch.size();
        }
        log.info("pin-tags 자모·초성 백필 완료: {}건 업데이트", total);
    }
}
