package com.yuhan.wagglewaggle.global.config;

import com.yuhan.wagglewaggle.domain.pin.tag.document.PinTagDocument;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.data.elasticsearch.core.IndexOperations;

@Configuration
public class ElasticsearchIndexInitializer {

    // 기동 시 pin-tags 인덱스가 없으면 @Document 매핑 + @Setting 분석기와 함께 생성한다.
    // 이미 있으면 그대로 두어 기존 데이터를 보존
    @Bean
    public ApplicationRunner pinTagsIndexRunner(ElasticsearchOperations operations) {
        return args -> {
            IndexOperations indexOps = operations.indexOps(PinTagDocument.class);
            if (!indexOps.exists()) {
                indexOps.createWithMapping();
            }
        };
    }
}
