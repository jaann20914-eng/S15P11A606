package com.yuhan.wagglewaggle.support;

import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;
import org.testcontainers.utility.TestcontainersConfiguration;

/**
 * PostGIS Testcontainer를 JVM 전체에서 1개만 공유하는 @DataJpaTest 공통 베이스.
 *
 * <p>기존에는 각 @DataJpaTest 클래스가 {@code @Container static}으로 PostGIS 컨테이너를 개별 기동해
 * 클래스 수만큼 컨테이너 부팅 + Flyway 마이그레이션이 반복됐다. 이 베이스를 상속하면 컨테이너를
 * static 초기화 시점에 1회만 start 하고 모든 테스트가 공유한다(@Container 미사용 → 클래스별 stop/start 없음).
 * 컨테이너는 JVM 종료 시 Testcontainers Ryuk가 정리한다.
 *
 * <p>datasource 속성이 모든 서브클래스에서 동일해지므로 Spring 컨텍스트 캐시도 재사용된다.
 */
@DataJpaTest
@ActiveProfiles("test")
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
public abstract class AbstractPostgresContainerTest {

    @SuppressWarnings("resource")
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>(
            DockerImageName.parse("postgis/postgis:16-3.4").asCompatibleSubstituteFor("postgres"))
            // 로컬에서 Gradle 실행 간 컨테이너를 재사용해 반복 테스트를 빠르게 한다.
            // reuse 활성화(testcontainers.reuse.enable=true 또는 TESTCONTAINERS_REUSE_ENABLE=true)가
            // 안 된 환경(예: CI)에서는 무시되고 매번 새 컨테이너가 기동된다.
            .withReuse(true);

    static {
        POSTGRES.start();
        // CI처럼 Ryuk이 꺼진(TESTCONTAINERS_RYUK_DISABLED=true) 환경에서는 컨테이너가 자동 정리되지 않아
        // 빌드마다 호스트에 컨테이너가 누적된다. reuse가 꺼진 환경에서는 JVM 종료 시 직접 stop 한다.
        // reuse가 켜진 로컬에서는 다음 실행에서 재사용하도록 종료 훅을 등록하지 않는다.
        if (!TestcontainersConfiguration.getInstance().environmentSupportsReuse()) {
            Runtime.getRuntime().addShutdownHook(new Thread(POSTGRES::stop));
        }
    }

    @DynamicPropertySource
    static void datasourceProps(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("spring.datasource.driver-class-name", () -> "org.postgresql.Driver");
    }
}
