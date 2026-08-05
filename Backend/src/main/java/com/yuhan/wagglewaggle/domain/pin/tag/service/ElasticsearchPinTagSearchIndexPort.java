package com.yuhan.wagglewaggle.domain.pin.tag.service;

import com.yuhan.wagglewaggle.domain.pin.tag.document.PinTagDocument;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.data.elasticsearch.core.geo.GeoPoint;
import org.springframework.data.elasticsearch.core.query.Criteria;
import org.springframework.data.elasticsearch.core.query.CriteriaQuery;
import org.springframework.data.elasticsearch.core.query.DeleteQuery;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * {@link PinTagSearchIndexPort}의 Elasticsearch 구현.
 *
 * <p>읽기 쪽 {@code TagSearchService}가 쓰는 {@link ElasticsearchOperations}를 그대로 재사용한다.
 * 색인은 "pinId로 기존 문서 전부 삭제 → 현재 태그로 다시 색인"하는 delete-first 방식이라,
 * 최초 색인은 물론 태그 추가·삭제·변경도 하나의 경로로 균일하게 반영하고 중복 실행에 멱등하다.</p>
 *
 * <p>afterCommit에서 호출되는 best-effort 작업이므로 모든 예외를 삼키고 로깅만 한다.
 * 색인 실패가 이미 커밋된 핀 처리(등록/수정/삭제)에 영향을 주지 않도록 한다.</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ElasticsearchPinTagSearchIndexPort implements PinTagSearchIndexPort {

    private final ElasticsearchOperations operations;

    @Override
    public void index(UUID pinId, List<String> tags, double latitude, double longitude, Instant expiresAt) {
        try {
            deleteByPinId(pinId);
            if (tags == null || tags.isEmpty()) {
                return;
            }
            GeoPoint location = new GeoPoint(latitude, longitude);
            List<PinTagDocument> documents = tags.stream()
                    .map(tag -> new PinTagDocument(
                            documentId(pinId, tag), tag, pinId.toString(), location, true, expiresAt))
                    .toList();
            operations.save(documents);
            log.info("핀 태그 색인 완료 (pinId={}, tagCount={})", pinId, documents.size());
        } catch (Exception e) {
            log.error("핀 태그 색인 실패 (pinId={}). 인덱스가 DB와 잠시 어긋날 수 있음", pinId, e);
        }
    }

    @Override
    public void removeByPin(UUID pinId) {
        try {
            deleteByPinId(pinId);
            log.info("핀 태그 문서 제거 완료 (pinId={})", pinId);
        } catch (Exception e) {
            log.error("핀 태그 문서 제거 실패 (pinId={}). 인덱스가 DB와 잠시 어긋날 수 있음", pinId, e);
        }
    }

    /** pinId term으로 해당 핀의 모든 태그 문서를 삭제한다. */
    private void deleteByPinId(UUID pinId) {
        CriteriaQuery query = new CriteriaQuery(Criteria.where("pinId").is(pinId.toString()));
        operations.delete(DeleteQuery.builder(query).build(), PinTagDocument.class);
    }

    /** 결정적 문서 id: 같은 (핀, 태그)는 항상 같은 문서로 매핑된다. */
    private String documentId(UUID pinId, String tag) {
        return pinId + ":" + tag;
    }
}
