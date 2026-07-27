# 1단계: Spring Boot 애플리케이션 빌드
FROM eclipse-temurin:21-jdk AS builder

WORKDIR /workspace

COPY . .

RUN chmod +x gradlew \
    && ./gradlew clean bootJar -x test --no-daemon \
    && JAR_FILE="$(find build/libs -maxdepth 1 -type f -name '*.jar' ! -name '*-plain.jar' | head -n 1)" \
    && test -n "$JAR_FILE" \
    && cp "$JAR_FILE" /workspace/app.jar


# 2단계: 만들어진 JAR만 실행
FROM eclipse-temurin:21-jre

WORKDIR /app

COPY --from=builder /workspace/app.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]