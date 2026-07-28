package com.yuhan.wagglewaggle.domain.pin.tag;

import com.yuhan.wagglewaggle.domain.pin.tag.document.PinTagDocument;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.elasticsearch.core.ElasticsearchOperations;
import org.springframework.data.elasticsearch.core.IndexOperations;
import org.springframework.data.elasticsearch.core.geo.GeoPoint;
import org.springframework.data.elasticsearch.core.query.Query;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.elasticsearch.ElasticsearchContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Testcontainers
class TagSearchIntegrationTest {

    // 테스트 실행 동안만 살아있는 일회용 ES 컨테이너(도커 필요). 클라이언트와 버전을 맞춘 9.2.8.
    @Container
    static ElasticsearchContainer ES = new ElasticsearchContainer(
            "docker.elastic.co/elasticsearch/elasticsearch:9.2.8")
            .withEnv("xpack.security.enabled", "false");

    // 컨테이너가 받은 랜덤 포트 주소를 스프링의 ES 접속 URI로 주입 → 앱이 이 컨테이너에 붙는다.
    @DynamicPropertySource
    static void esProps(DynamicPropertyRegistry registry) {
        registry.add("spring.elasticsearch.uris", ES::getHttpHostAddress);
    }

    @Autowired
    ElasticsearchOperations operations;

    // 각 테스트 전에 인덱스를 지우고 매핑과 함께 새로 만들어, 테스트 간 데이터 간섭을 없앤다.
    @BeforeEach
    void cleanIndex() {
        IndexOperations indexOps = operations.indexOps(PinTagDocument.class);
        if (indexOps.exists()) {
            indexOps.delete();
        }
        indexOps.createWithMapping();
    }

    @Test
    void 색인된_문서를_조회할_수_있다() {
        Instant future = Instant.now().plus(1, ChronoUnit.DAYS);
        operations.save(new PinTagDocument("1", "데이트", 1L, new GeoPoint(37.5, 127.0), true, future));
        operations.indexOps(PinTagDocument.class).refresh();

        long count = operations.count(Query.findAll(), PinTagDocument.class);

        assertThat(count).isEqualTo(1);
    }
}
