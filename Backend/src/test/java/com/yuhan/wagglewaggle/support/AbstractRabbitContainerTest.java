package com.yuhan.wagglewaggle.support;

import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.RabbitMQContainer;
import org.testcontainers.utility.DockerImageName;
import org.testcontainers.utility.TestcontainersConfiguration;

/**
 * RabbitMQ Testcontainer를 JVM 전체에서 1개만 공유하는 통합 테스트 공통 베이스.
 *
 * <p>기존에는 발행/소비 통합 테스트가 각각 {@code @Container static}으로 RabbitMQ 컨테이너를
 * 개별 기동해 클래스 수만큼 브로커 부팅이 반복됐다(RabbitMQ 부팅은 특히 느리다). 이 베이스를 상속하면
 * 컨테이너를 static 초기화 시점에 1회만 start 하고 모든 테스트가 같은 브로커를 공유한다.
 * 컨테이너는 JVM 종료 시 Testcontainers Ryuk가 정리한다(@Container 미사용).
 *
 * <p>테스트 슬라이스({@code @SpringBootTest(classes = ...)})가 서로 달라 Spring 컨텍스트는 공유되지
 * 않지만, 가장 비싼 브로커 부팅이 1회로 줄어든다. 각 테스트는 자체 {@code @BeforeEach}에서 큐를
 * purge 하므로 브로커 공유로 인한 메시지 오염은 발생하지 않는다.
 *
 * <p>발행 테스트가 요구하는 publisher-confirm/return 속성을 기본으로 채운다. 소비 전용 테스트에는
 * 불필요하지만 활성화돼도 동작에 영향이 없다.
 */
public abstract class AbstractRabbitContainerTest {

    @SuppressWarnings("resource")
    static final RabbitMQContainer RABBIT = new RabbitMQContainer(
            DockerImageName.parse("rabbitmq:4-management").asCompatibleSubstituteFor("rabbitmq"))
            // 로컬에서 Gradle 실행 간 컨테이너를 재사용해 반복 테스트를 빠르게 한다.
            // reuse 활성화(testcontainers.reuse.enable=true 또는 TESTCONTAINERS_REUSE_ENABLE=true)가
            // 안 된 환경(예: CI)에서는 무시되고 매번 새 컨테이너가 기동된다.
            .withReuse(true);

    static {
        RABBIT.start();
        // CI처럼 Ryuk이 꺼진(TESTCONTAINERS_RYUK_DISABLED=true) 환경에서는 컨테이너가 자동 정리되지 않아
        // 빌드마다 호스트에 컨테이너가 누적된다. reuse가 꺼진 환경에서는 JVM 종료 시 직접 stop 한다.
        // reuse가 켜진 로컬에서는 다음 실행에서 재사용하도록 종료 훅을 등록하지 않는다.
        if (!TestcontainersConfiguration.getInstance().environmentSupportsReuse()) {
            Runtime.getRuntime().addShutdownHook(new Thread(RABBIT::stop));
        }
    }

    @DynamicPropertySource
    static void rabbitProps(DynamicPropertyRegistry registry) {
        registry.add("spring.rabbitmq.host", RABBIT::getHost);
        registry.add("spring.rabbitmq.port", RABBIT::getAmqpPort);
        registry.add("spring.rabbitmq.username", RABBIT::getAdminUsername);
        registry.add("spring.rabbitmq.password", RABBIT::getAdminPassword);
        registry.add("spring.rabbitmq.publisher-confirm-type", () -> "correlated");
        registry.add("spring.rabbitmq.publisher-returns", () -> "true");
    }
}
