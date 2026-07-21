# PostgreSQL과 MySQL 비교 정리

## 1. 공통점

PostgreSQL과 MySQL은 모두 대표적인 관계형 데이터베이스 관리 시스템이다.

두 데이터베이스 모두 다음 기능을 제공한다.

- 테이블과 관계
- SQL
- 트랜잭션
- 인덱스
- 제약 조건
- 조인
- 복제
- 백업과 복구
- 사용자와 권한 관리

Spring Boot에서는 둘 다 JPA, Hibernate, MyBatis와 함께 사용할 수 있다.

```text
Spring Boot
→ PostgreSQL 또는 MySQL
```

단순한 CRUD 서비스에서는 둘 중 어느 것을 사용해도 대부분의 기능을 구현할 수 있다.

차이는 복잡한 쿼리, 데이터 타입, 확장 기능, 동시성 처리, 운영 방식에서 더 분명하게 나타난다.

---

## 2. 기본 성격

### PostgreSQL

PostgreSQL은 SQL 표준 준수, 데이터 정확성, 복잡한 쿼리, 확장성을 중요하게 보는 데이터베이스다.

다음 기능에 강점이 있다.

- 복잡한 조인과 집계
- 다양한 데이터 타입
- JSONB
- 배열
- 윈도우 함수
- 재귀 쿼리
- 부분 인덱스
- 표현식 인덱스
- PostGIS 같은 확장 기능

### MySQL

MySQL은 설치와 운영이 비교적 단순하고, 일반적인 웹 서비스에서 널리 사용되는 데이터베이스다.

다음 상황에서 자주 사용한다.

- 일반적인 웹 애플리케이션
- CRUD 중심 서비스
- 읽기 중심 서비스
- 비교적 단순한 데이터 모델
- 기존 시스템이 MySQL 기반인 경우

---

## 3. 비교 요약

| 항목 | PostgreSQL | MySQL |
|---|---|---|
| 기본 성격 | 기능과 확장성이 강함 | 단순성과 대중성이 강함 |
| SQL 표준 | 비교적 적극적으로 지원 | 실용적인 호환성 중심 |
| 복잡한 쿼리 | 강점이 있음 | 일반적인 쿼리에 충분함 |
| JSON | JSON, JSONB | JSON |
| 배열 타입 | 지원 | 전용 배열 타입 없음 |
| 공간 데이터 | PostGIS 확장이 강력함 | Spatial 기능 지원 |
| 인덱스 종류 | 다양함 | 주로 B-Tree 중심 |
| 확장 기능 | 매우 다양함 | 비교적 제한적 |
| 운영 난도 | 기능이 많은 만큼 고려할 점이 많음 | 비교적 접근하기 쉬움 |
| 웹 서비스 사용 | 널리 사용됨 | 매우 널리 사용됨 |

---

## 4. 스토리지 구조

### PostgreSQL

PostgreSQL은 핵심 기능이 하나의 통합된 구조로 동작한다.

```text
PostgreSQL
→ 자체 테이블 저장 구조
→ 자체 트랜잭션 처리
→ 자체 인덱스 구조
```

### MySQL

MySQL은 스토리지 엔진 구조를 가진다.

대표적인 스토리지 엔진은 InnoDB다.

```text
MySQL
→ SQL 처리 계층
→ InnoDB 스토리지 엔진
```

현대 MySQL 서비스에서는 대부분 InnoDB를 사용한다.

InnoDB는 다음 기능을 제공한다.

- 트랜잭션
- 외래 키
- 행 수준 잠금
- MVCC
- 장애 복구

---

## 5. 트랜잭션과 MVCC

두 데이터베이스 모두 MVCC를 사용한다.

MVCC는 데이터의 여러 버전을 관리해 읽기와 쓰기가 서로 지나치게 막히지 않도록 하는 방식이다.

### PostgreSQL

PostgreSQL은 행이 수정될 때 새 행 버전을 만든다.

```text
UPDATE
→ 새 행 버전 생성
→ 이전 행 버전 유지
→ VACUUM으로 정리
```

필요 없어진 행 버전은 VACUUM이 정리한다.

### MySQL InnoDB

InnoDB는 현재 레코드와 Undo Log를 이용해 이전 버전을 제공한다.

```text
현재 데이터
+
Undo Log
→ 필요한 이전 버전 복원
```

둘 다 MVCC를 사용하지만 내부 구현 방식은 다르다.

---

## 6. 격리 수준

트랜잭션 격리 수준은 동시에 실행되는 트랜잭션이 서로의 변경을 어느 정도까지 볼 수 있는지 정한다.

대표적인 격리 수준은 다음과 같다.

```text
READ COMMITTED
REPEATABLE READ
SERIALIZABLE
```

### PostgreSQL

기본 격리 수준은 일반적으로 `READ COMMITTED`다.

### MySQL InnoDB

기본 격리 수준은 일반적으로 `REPEATABLE READ`다.

같은 코드를 실행해도 기본 격리 수준 차이 때문에 동시성 동작이 달라질 수 있다.

---

## 7. 잠금

두 데이터베이스 모두 행 수준 잠금을 지원한다.

```sql
SELECT *
FROM products
WHERE id = 1
FOR UPDATE;
```

### PostgreSQL

행 잠금과 MVCC를 조합해 동시성을 처리한다.

### MySQL InnoDB

InnoDB는 다음 잠금을 사용할 수 있다.

```text
Record Lock
→ 실제 레코드 잠금

Gap Lock
→ 레코드 사이 범위 잠금

Next-Key Lock
→ 레코드와 범위를 함께 잠금
```

MySQL에서는 잠금 쿼리가 적절한 인덱스를 사용하지 않으면 예상보다 넓은 범위를 잠글 수 있다.

---

## 8. 데이터 타입

### PostgreSQL

PostgreSQL은 다양한 타입을 제공한다.

- 정수
- 문자열
- 날짜와 시간
- UUID
- JSON
- JSONB
- 배열
- 네트워크 주소
- 범위
- 열거형
- 공간 데이터

예를 들어 배열 타입을 사용할 수 있다.

```sql
CREATE TABLE posts (
    id BIGSERIAL PRIMARY KEY,
    tags TEXT[]
);
```

### MySQL

MySQL도 일반적인 웹 서비스에 필요한 타입을 충분히 제공한다.

- 정수
- 문자열
- 날짜와 시간
- JSON
- 열거형
- 공간 데이터

PostgreSQL보다 전용 타입의 종류는 적지만 일반적인 CRUD 서비스에는 충분한 경우가 많다.

---

## 9. 자동 증가 기본 키

### PostgreSQL

```sql
CREATE TABLE users (
    id BIGINT GENERATED ALWAYS AS IDENTITY
);
```

### MySQL

```sql
CREATE TABLE users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY
);
```

Spring JPA에서는 둘 다 다음처럼 사용할 수 있다.

```java
@Id
@GeneratedValue(strategy = GenerationType.IDENTITY)
private Long id;
```

---

## 10. 문자열 비교

문자열 비교는 Collation 설정에 영향을 받는다.

### PostgreSQL

기본 문자열 비교는 대소문자를 구분하는 경우가 일반적이다.

대소문자를 무시한 검색에는 `ILIKE`를 사용할 수 있다.

```sql
SELECT *
FROM users
WHERE nickname ILIKE '%kim%';
```

### MySQL

대소문자를 구분하지 않는 Collation을 기본으로 사용하는 환경이 많다.

```sql
SELECT *
FROM users
WHERE nickname LIKE '%kim%';
```

실제 동작은 설정된 Collation에 따라 달라진다.

---

## 11. JSON

### PostgreSQL JSONB

PostgreSQL은 `JSON`과 `JSONB`를 지원한다.

```text
JSON
→ 입력 문자열 형태 보존

JSONB
→ 내부 바이너리 형태로 저장
→ 검색과 인덱싱에 유리
```

```sql
CREATE TABLE products (
    id BIGSERIAL PRIMARY KEY,
    attributes JSONB
);
```

```sql
SELECT *
FROM products
WHERE attributes ->> 'color' = 'blue';
```

GIN 인덱스를 사용할 수 있다.

```sql
CREATE INDEX idx_products_attributes
ON products
USING GIN (attributes);
```

### MySQL JSON

MySQL도 `JSON` 타입을 지원한다.

```sql
CREATE TABLE products (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    attributes JSON
);
```

```sql
SELECT *
FROM products
WHERE attributes ->> '$.color' = 'blue';
```

JSON 검색 최적화에는 생성 컬럼과 인덱스를 함께 사용할 수 있다.

---

## 12. 인덱스

두 데이터베이스 모두 B-Tree 계열 인덱스를 기본적으로 사용한다.

```sql
CREATE INDEX idx_users_email
ON users(email);
```

### PostgreSQL

다양한 인덱스 방식을 지원한다.

```text
B-Tree
Hash
GIN
GiST
BRIN
```

부분 인덱스를 만들 수 있다.

```sql
CREATE INDEX idx_active_users_email
ON users(email)
WHERE status = 'ACTIVE';
```

표현식 인덱스도 가능하다.

```sql
CREATE INDEX idx_users_lower_email
ON users(LOWER(email));
```

### MySQL

MySQL InnoDB는 B-Tree 계열 인덱스를 중심으로 사용한다.

Full-Text Index와 Spatial Index도 지원한다.

---

## 13. 기본 키와 데이터 배치

### MySQL InnoDB

InnoDB는 기본 키를 중심으로 데이터가 구성되는 클러스터드 인덱스 구조를 사용한다.

```text
Primary Key
→ 실제 행 데이터와 연결된 중심 구조
```

보조 인덱스에는 일반적으로 기본 키 값이 포함된다.

기본 키가 지나치게 크면 보조 인덱스도 커질 수 있다.

### PostgreSQL

PostgreSQL의 테이블과 인덱스는 기본적으로 별도 구조다.

기본 키도 인덱스지만 테이블 자체가 항상 기본 키 순서로 저장되는 것은 아니다.

---

## 14. 복잡한 쿼리

PostgreSQL은 다음 쿼리에 강점이 있다.

- 복잡한 조인
- 서브쿼리
- 윈도우 함수
- CTE
- 재귀 CTE
- 집계
- JSONB 처리

```sql
SELECT
    user_id,
    amount,
    SUM(amount) OVER (
        PARTITION BY user_id
        ORDER BY created_at
    ) AS cumulative_amount
FROM orders;
```

MySQL도 현대 버전에서는 CTE와 윈도우 함수를 지원한다.

일반적인 웹 서비스 쿼리에는 충분한 기능을 제공한다.

---

## 15. 공간 데이터

### PostgreSQL + PostGIS

PostGIS는 PostgreSQL의 공간 데이터 확장이다.

다음 기능을 제공한다.

- 거리 계산
- 반경 검색
- 다각형 포함 여부
- 좌표계 변환
- 공간 조인
- 공간 인덱스

복잡한 위치 기반 서비스에서는 PostgreSQL과 PostGIS 조합이 강력하다.

### MySQL Spatial

MySQL도 공간 타입과 Spatial Index를 지원한다.

단순한 반경 검색이나 위치 조회에는 충분히 사용할 수 있다.

고급 GIS 분석에서는 PostGIS가 더 유리한 경우가 많다.

---

## 16. 전문 검색

### PostgreSQL

Full Text Search 기능을 제공한다.

```sql
SELECT *
FROM documents
WHERE to_tsvector('english', content)
      @@ plainto_tsquery('english', 'database');
```

### MySQL

Full-Text Index를 제공한다.

```sql
SELECT *
FROM documents
WHERE MATCH(title, content)
      AGAINST('database');
```

복잡한 검색 서비스에서는 Elasticsearch나 OpenSearch 같은 전용 검색 엔진을 함께 사용할 수 있다.

---

## 17. 확장 기능

### PostgreSQL

확장 기능 생태계가 강하다.

```text
PostGIS
→ 공간 데이터

pg_trgm
→ 유사 문자열 검색

pgvector
→ 벡터 검색
```

### MySQL

플러그인과 확장 기능을 제공하지만 PostgreSQL과 확장 방식과 생태계가 다르다.

일반적인 웹 서비스 기능은 충분히 지원한다.

---

## 18. 복제와 고가용성

두 데이터베이스 모두 Primary와 Replica 구조를 만들 수 있다.

```text
Primary
→ Replica
```

### PostgreSQL

WAL을 기반으로 복제한다.

```text
WAL
→ Write-Ahead Log
```

### MySQL

Binary Log를 기반으로 복제한다.

```text
Binary Log
→ 데이터 변경 기록
```

Replica는 읽기 분산, 장애 대응, 백업 등에 사용할 수 있다.

---

## 19. VACUUM과 데이터 정리

### PostgreSQL

MVCC로 생성된 오래된 행 버전을 VACUUM이 정리한다.

```text
UPDATE와 DELETE
→ 오래된 행 버전 발생
→ VACUUM으로 정리
```

Autovacuum 설정이 부적절하면 테이블과 인덱스가 불필요하게 커질 수 있다.

### MySQL

InnoDB는 Undo Log와 Purge 작업을 통해 이전 버전을 정리한다.

오래 실행되는 트랜잭션은 두 데이터베이스 모두 정리 작업을 방해할 수 있다.

---

## 20. 스키마

### PostgreSQL

하나의 데이터베이스 안에 여러 스키마를 둘 수 있다.

```text
database
├─ public
├─ account
└─ analytics
```

```sql
account.users
analytics.users
```

### MySQL

MySQL에서는 `DATABASE`와 `SCHEMA`가 거의 같은 의미로 사용된다.

PostgreSQL의 스키마와 구조적으로 차이가 있다.

---

## 21. 데이터 정합성

두 데이터베이스 모두 다음 제약 조건을 지원한다.

- PRIMARY KEY
- FOREIGN KEY
- UNIQUE
- NOT NULL
- CHECK

PostgreSQL은 엄격한 타입 처리와 데이터 정합성을 중요하게 보는 경향이 있다.

MySQL도 제약 조건을 충분히 지원하지만 SQL Mode 설정에 따라 입력 처리 방식이 달라질 수 있다.

운영 환경에서는 Strict Mode 설정을 확인하는 것이 좋다.

---

## 22. 성능 비교

다음처럼 단정하면 안 된다.

```text
MySQL이 항상 빠르다.
PostgreSQL이 항상 빠르다.
```

성능은 다음 조건에 따라 달라진다.

- 테이블 구조
- 데이터 크기
- 인덱스
- 쿼리 형태
- 읽기와 쓰기 비율
- 동시 접속 수
- 트랜잭션 길이
- 메모리와 디스크
- 데이터베이스 버전

복잡한 분석 쿼리, JSON 검색, 공간 연산에서는 PostgreSQL이 유리할 수 있다.

단순 CRUD에서는 두 데이터베이스의 차이가 크지 않을 수 있다.

최종 판단은 실제 데이터와 쿼리를 이용한 테스트로 해야 한다.

---

## 23. Spring Boot에서의 차이

### MySQL 설정

```yaml
spring:
  datasource:
    url: jdbc:mysql://localhost:3306/app
    username: root
    password: password
    driver-class-name: com.mysql.cj.jdbc.Driver
```

### PostgreSQL 설정

```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/app
    username: postgres
    password: password
    driver-class-name: org.postgresql.Driver
```

JPA 엔티티와 Repository 구조는 대부분 동일하다.

차이가 생길 수 있는 부분은 다음과 같다.

- 자동 증가 전략
- 예약어
- 날짜와 시간 처리
- Boolean 타입
- JSON 타입
- Native Query
- 대소문자 처리
- 공간 데이터
- DB별 함수

---

## 24. MyBatis에서의 차이

MyBatis는 SQL을 직접 작성하므로 데이터베이스 차이가 더 직접적으로 드러난다.

### PostgreSQL

```sql
INSERT INTO users(nickname)
VALUES (#{nickname})
RETURNING id;
```

### MySQL

```sql
INSERT INTO users(nickname)
VALUES (#{nickname});
```

MySQL에서는 generated key 설정을 사용할 수 있다.

```xml
<insert
    id="insertUser"
    useGeneratedKeys="true"
    keyProperty="id">
```

날짜 함수, 문자열 함수, JSON 함수도 데이터베이스마다 다르다.

---

## 25. PostgreSQL이 잘 맞는 경우

```text
복잡한 검색과 집계가 많다.
JSON 데이터를 적극적으로 검색한다.
위치 기반 검색이 중요하다.
배열이나 범위 타입이 필요하다.
부분 인덱스와 표현식 인덱스가 필요하다.
벡터 검색이나 확장 기능이 필요하다.
```

예시는 다음과 같다.

- 위치 기반 서비스
- 데이터 분석 서비스
- 복잡한 업무 시스템
- 리뷰와 검색 데이터 처리
- AI 벡터 검색
- GIS 서비스

---

## 26. MySQL이 잘 맞는 경우

```text
일반적인 CRUD 중심 웹 서비스다.
팀이 MySQL 운영에 익숙하다.
복잡한 DB 확장 기능이 필요하지 않다.
기존 시스템이 MySQL 기반이다.
단순한 운영 환경이 중요하다.
```

예시는 다음과 같다.

- 일반 커뮤니티
- 쇼핑몰
- 게시판
- 회원과 주문 중심 서비스
- 기존 MySQL 시스템 확장

---

## 27. 선택 기준

데이터베이스를 선택할 때는 다음을 확인한다.

```text
1. 필요한 기능
2. 데이터 모델
3. 주요 쿼리
4. 동시성 요구
5. 확장 기능
6. 팀의 운영 경험
7. 클라우드 지원
8. 실제 부하 테스트
```

### PostgreSQL을 우선 검토할 조건

```text
복잡한 데이터 기능
공간 검색
JSONB
분석 쿼리
확장 기능
```

### MySQL을 우선 검토할 조건

```text
일반적인 CRUD
익숙한 운영
기존 생태계
단순한 구조
```

---

## 28. 자주 하는 오해

### MySQL은 대규모 서비스에 사용할 수 없는가?

아니다.

MySQL도 대규모 서비스에서 널리 사용된다.

### PostgreSQL은 항상 느린가?

아니다.

쿼리와 데이터 구조에 따라 좋은 성능을 낼 수 있다.

### PostgreSQL은 분석용이고 MySQL은 웹용인가?

지나치게 단순한 구분이다.

둘 다 웹 서비스와 업무 시스템에 사용할 수 있다.

### JPA를 사용하면 DB를 쉽게 바꿀 수 있는가?

완전히 자유롭지는 않다.

다음 요소가 DB에 종속될 수 있다.

- Native Query
- 함수
- JSON 처리
- 인덱스
- 자동 증가 방식
- 공간 데이터
- SQL 문법

---

## 29. 핵심 정리

```text
PostgreSQL
→ 복잡한 쿼리, 다양한 타입, 확장 기능에 강점

MySQL
→ 일반적인 웹 서비스, 익숙한 운영 환경에 강점
```

주요 차이는 다음과 같다.

```text
PostgreSQL
→ JSONB
→ 배열
→ 부분 인덱스
→ 표현식 인덱스
→ PostGIS
→ 다양한 확장

MySQL
→ InnoDB
→ AUTO_INCREMENT
→ 익숙한 CRUD 구조
→ 넓은 사용 경험
→ 비교적 단순한 운영 접근
```

둘 중 하나가 모든 상황에서 더 좋은 것은 아니다.

서비스의 데이터 구조, 핵심 쿼리, 동시성, 운영 경험을 기준으로 선택해야 한다.
