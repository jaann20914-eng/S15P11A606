package com.yuhan.wagglewaggle.domain.pin.tag.document;

import lombok.Getter;
import org.springframework.data.annotation.Id;
import org.springframework.data.elasticsearch.annotations.Document;
import org.springframework.data.elasticsearch.annotations.Field;
import org.springframework.data.elasticsearch.annotations.FieldType;
import org.springframework.data.elasticsearch.annotations.GeoPointField;
import org.springframework.data.elasticsearch.annotations.InnerField;
import org.springframework.data.elasticsearch.annotations.MultiField;
import org.springframework.data.elasticsearch.annotations.Setting;
import org.springframework.data.elasticsearch.core.geo.GeoPoint;

import java.time.Instant;

// 핀-태그 1쌍 = 문서 1개
// 커스텀 분석기 정의는 pin-tags-settings.json 에서 로드
@Document(indexName = "pin-tags")
@Setting(settingPath = "elasticsearch/pin-tags-settings.json")
@Getter
public class PinTagDocument {

    @Id
    private String id;

    // 하나의 태그 값을 세 관점으로 동시에 색인(멀티필드)
    @MultiField(
            // tag: 분석 없이 통째 저장(keyword). 완전일치(term)와 collapse 중복 제거의 기준.
            mainField = @Field(type = FieldType.Keyword, normalizer = "lowercase_normalizer"),
            otherFields = {
                    // tag.prefix: 색인은 edge_ngram(앞에서부터 자른 조각), 검색은 질의어를 통째 소문자 토큰 1개로
                    //              → 접두어 매칭("데이" -> 데이트, 데이트코스)
                    @InnerField(suffix = "prefix", type = FieldType.Text,
                            analyzer = "edge_ngram_analyzer", searchAnalyzer = "lowercase_keyword_analyzer"),
                    // tag.ngram: 색인·검색 모두 2-gram으로 쪼갬 → 부분 일치("이트" -> 데이트)
                    @InnerField(suffix = "ngram", type = FieldType.Text,
                            analyzer = "ngram_analyzer", searchAnalyzer = "ngram_analyzer")
            }
    )
    private String tag;

    @Field(type = FieldType.Long)
    private Long pinId;

    // 반경 필터(geo_distance)의 기준 좌표
    @GeoPointField
    private GeoPoint location;

    // 삭제/비활성 핀 제외용. 검색 시 active=true 만 통과시킨다.
    @Field(type = FieldType.Boolean)
    private boolean active;

    // 만료 핀 제외용. 검색 시 expiresAt > now 조건으로 자동 제외한다.
    @Field(type = FieldType.Date)
    private Instant expiresAt;

    protected PinTagDocument() {
    }

    public PinTagDocument(String id, String tag, Long pinId, GeoPoint location, boolean active, Instant expiresAt) {
        this.id = id;
        this.tag = tag;
        this.pinId = pinId;
        this.location = location;
        this.active = active;
        this.expiresAt = expiresAt;
    }
}
