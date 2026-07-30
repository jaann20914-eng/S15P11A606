package com.yuhan.wagglewaggle.domain.pin.tag;

import com.yuhan.wagglewaggle.domain.pin.tag.document.PinTagDocument;
import com.yuhan.wagglewaggle.domain.pin.tag.service.TagSearchService;
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

    @Container
    static PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>(
            DockerImageName.parse("postgis/postgis:16-3.4").asCompatibleSubstituteFor("postgres"));

    @DynamicPropertySource
    static void esProps(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("spring.elasticsearch.uris", ES::getHttpHostAddress);
    }

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

    @Autowired
    TagSearchService service;

    private void save(String id, String tag, double lat, double lon) {
        operations.save(new PinTagDocument(
                id, tag, Long.parseLong(id), new GeoPoint(lat, lon), true,
                Instant.now().plus(1, ChronoUnit.DAYS)));
    }

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

    @Test
    void 완전일치_접두어_부분일치_순으로_정렬하고_중복을_제거한다() {
        // 중심(37.50,127.00) 반경 내
        save("1", "데이트", 37.5001, 127.0001);       // 완전일치
        save("2", "데이트코스", 37.5002, 127.0002);   // 접두어
        save("3", "맛집데이트", 37.5003, 127.0003);   // 부분(포함)
        save("4", "데이트", 37.5004, 127.0004);       // 중복 태그명 → 1건으로 합쳐져야
        // 반경 밖(약 수십 km)
        save("5", "데이트천국", 37.9000, 127.9000);
        operations.indexOps(PinTagDocument.class).refresh();

        var names = service.search("데이트", 37.50, 127.00).tags()
                .stream().map(t -> t.name()).toList();

        assertThat(names).containsExactly("데이트", "데이트코스", "맛집데이트");
    }

    @Test
    void 반경_내에_일치하는_태그가_없으면_빈_결과를_반환한다() {
        save("1", "데이트천국", 37.9000, 127.9000); // 반경 밖
        operations.indexOps(PinTagDocument.class).refresh();

        assertThat(service.search("데이트", 37.50, 127.00).tags()).isEmpty();
    }
}
