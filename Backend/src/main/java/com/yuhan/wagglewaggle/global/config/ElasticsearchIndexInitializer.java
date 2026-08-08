package com.yuhan.wagglewaggle.global.config;

import com.yuhan.wagglewaggle.domain.pin.tag.document.PinTagDocument;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.data.elasticsearch.core.IndexOperations;

@Slf4j
@Configuration
public class ElasticsearchIndexInitializer {

    // 기동 시 pin-tags 인덱스를 @Document 매핑과 정합화한다.
    // - 인덱스가 없으면 @Document 매핑 + @Setting 분석기와 함께 생성한다.
    // - 이미 있으면 putMapping으로 신규 필드(tagJamo/tagChosung 등)만 병합한다(기존 데이터·설정 보존).
    //   ES는 필드 추가를 허용하므로 멱등하며, 기존 필드 변경이 없는 한 안전하다.
    //   (운영 배포 시 새 코드가 색인을 시작하기 전에 매핑을 정비해, 동적 매핑으로 잘못된 타입이 굳는 것을 막는다.)
    @Bean
    @Order(1) // 백필 러너(@Order(2))보다 먼저 실행돼 신규 필드 매핑을 먼저 확정한다.
    public ApplicationRunner pinTagsIndexRunner(ElasticsearchOperations operations) {
        return args -> {
            IndexOperations indexOps = operations.indexOps(PinTagDocument.class);
            if (!indexOps.exists()) {
                indexOps.createWithMapping();
                log.info("pin-tags 인덱스를 신규 생성했습니다.");
            } else {
                indexOps.putMapping();
                log.info("pin-tags 인덱스 매핑을 최신 필드로 병합했습니다.");
            }
        };
    }
}
