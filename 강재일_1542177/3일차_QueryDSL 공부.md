# QueryDSL 원리와 사용법 정리

## 1. QueryDSL이란?

QueryDSL은 자바 코드로 쿼리를 작성할 수 있게 해주는 라이브러리다.

JPA 환경에서는 주로 다음 목적으로 사용한다.

- 복잡한 조회
- 동적 검색 조건
- 조인
- DTO 조회
- 정렬과 페이징
- 문자열 JPQL 오류 방지

JPQL은 문자열로 작성한다.

```java
String jpql =
        "select u from User u "
        + "where u.nickname = :nickname";
```

QueryDSL은 자바 코드로 작성한다.

```java
QUser user = QUser.user;

List<User> result = queryFactory
        .selectFrom(user)
        .where(user.nickname.eq(nickname))
        .fetch();
```

---

## 2. QueryDSL을 사용하는 이유

문자열 쿼리는 필드명을 잘못 적어도 컴파일 단계에서 찾기 어렵다.

```java
"where u.nicknmae = :nickname"
```

QueryDSL은 엔티티 필드를 자바 객체로 표현한다.

```java
user.nickname.eq(nickname)
```

존재하지 않는 필드를 사용하면 컴파일 오류가 발생한다.

```text
문자열 JPQL
→ 실행 시점 오류 가능

QueryDSL
→ 컴파일 시점 오류 확인 가능
```

---

## 3. Q타입

QueryDSL은 엔티티를 기반으로 Q타입을 생성한다.

```java
@Entity
public class User {

    @Id
    private Long id;

    private String nickname;
    private Integer age;
}
```

생성된 Q타입은 개념적으로 다음과 같다.

```java
public class QUser extends EntityPathBase<User> {

    public static final QUser user =
            new QUser("user");

    public final NumberPath<Long> id;
    public final StringPath nickname;
    public final NumberPath<Integer> age;
}
```

쿼리에서는 Q타입을 사용한다.

```java
QUser user = QUser.user;

queryFactory
        .selectFrom(user)
        .where(user.age.goe(20))
        .fetch();
```

Q타입은 엔티티 구조를 쿼리에서 사용할 수 있게 만든 메타 모델이다.

---

## 4. 동작 흐름

```text
JPA 엔티티 작성
→ QueryDSL 코드 생성기 실행
→ Q타입 생성
→ Q타입으로 쿼리 작성
→ JPQL 생성
→ Hibernate가 SQL로 변환
→ DB 실행
```

QueryDSL JPA가 SQL을 직접 실행하는 것은 아니다.

```text
QueryDSL
→ JPQL 생성

Hibernate
→ JPQL을 SQL로 변환
```

---

## 5. JPAQueryFactory

QueryDSL 쿼리는 보통 `JPAQueryFactory`로 작성한다.

```java
@Configuration
public class QueryDslConfig {

    @PersistenceContext
    private EntityManager entityManager;

    @Bean
    public JPAQueryFactory jpaQueryFactory() {
        return new JPAQueryFactory(entityManager);
    }
}
```

Repository에서 주입받는다.

```java
@Repository
@RequiredArgsConstructor
public class UserQueryRepository {

    private final JPAQueryFactory queryFactory;
}
```

---

## 6. 기본 조회

### 목록 조회

```java
List<User> users = queryFactory
        .selectFrom(user)
        .fetch();
```

### 단건 조회

```java
User result = queryFactory
        .selectFrom(user)
        .where(user.id.eq(userId))
        .fetchOne();
```

### 첫 번째 결과 조회

```java
User result = queryFactory
        .selectFrom(user)
        .where(user.nickname.eq(nickname))
        .fetchFirst();
```

```text
fetch()
→ 목록 반환

fetchOne()
→ 단건 반환

fetchFirst()
→ 첫 번째 결과 반환
```

---

## 7. 조건절

```java
user.id.eq(1L)
user.age.gt(20)
user.age.goe(20)
user.age.lt(30)
user.age.loe(30)
user.nickname.contains("kim")
user.nickname.startsWith("k")
user.id.in(1L, 2L, 3L)
user.nickname.isNull()
```

`where()`에 여러 조건을 넣으면 AND로 연결된다.

```java
queryFactory
        .selectFrom(user)
        .where(
                user.age.goe(20),
                user.nickname.contains("kim")
        )
        .fetch();
```

OR 조건은 다음처럼 작성한다.

```java
user.age.lt(20)
        .or(user.age.gt(60))
```

---

## 8. 동적 쿼리

QueryDSL의 대표적인 장점이다.

검색 조건이 있을 때만 조건절에 포함할 수 있다.

```java
private BooleanExpression nicknameEq(
        String nickname
) {
    return nickname == null
            ? null
            : user.nickname.eq(nickname);
}
```

```java
private BooleanExpression ageGoe(
        Integer age
) {
    return age == null
            ? null
            : user.age.goe(age);
}
```

조회에서는 다음처럼 사용한다.

```java
List<User> result = queryFactory
        .selectFrom(user)
        .where(
                nicknameEq(condition.nickname()),
                ageGoe(condition.age())
        )
        .fetch();
```

`where()`는 `null` 조건을 무시한다.

따라서 값이 없는 검색 조건은 쿼리에서 제외된다.

---

## 9. BooleanBuilder

동적 조건을 순서대로 추가할 수도 있다.

```java
BooleanBuilder builder = new BooleanBuilder();

if (nickname != null) {
    builder.and(user.nickname.eq(nickname));
}

if (age != null) {
    builder.and(user.age.goe(age));
}

List<User> result = queryFactory
        .selectFrom(user)
        .where(builder)
        .fetch();
```

```text
BooleanBuilder
→ 조건 흐름을 한곳에서 보기 좋다.

BooleanExpression
→ 조건을 메서드로 분리하고 재사용하기 좋다.
```

---

## 10. 정렬과 페이징

### 정렬

```java
queryFactory
        .selectFrom(user)
        .orderBy(
                user.age.desc(),
                user.id.asc()
        )
        .fetch();
```

### 페이징

```java
queryFactory
        .selectFrom(user)
        .offset(pageable.getOffset())
        .limit(pageable.getPageSize())
        .fetch();
```

전체 개수는 별도 count 쿼리로 조회할 수 있다.

```java
Long total = queryFactory
        .select(user.count())
        .from(user)
        .where(ageGoe(age))
        .fetchOne();
```

---

## 11. Join

```java
QTeam team = QTeam.team;

List<User> users = queryFactory
        .selectFrom(user)
        .join(user.team, team)
        .where(team.name.eq("backend"))
        .fetch();
```

주요 조인은 다음과 같다.

```text
join()
→ inner join

leftJoin()
→ left outer join
```

---

## 12. Fetch Join

연관 엔티티를 한 번에 조회할 때 사용한다.

```java
List<User> users = queryFactory
        .selectFrom(user)
        .join(user.team, team)
        .fetchJoin()
        .fetch();
```

```text
일반 join
→ 조회 조건이나 연결에 사용

fetch join
→ 연관 엔티티까지 함께 로딩
```

N+1 문제를 줄이는 데 사용할 수 있다.

다만 컬렉션 fetch join과 페이징을 함께 사용할 때는 주의해야 한다.

---

## 13. DTO 조회

필요한 필드만 DTO로 조회할 수 있다.

### 생성자 방식

```java
List<UserResponse> result = queryFactory
        .select(
                Projections.constructor(
                        UserResponse.class,
                        user.id,
                        user.nickname,
                        user.age
                )
        )
        .from(user)
        .fetch();
```

### QueryProjection 방식

```java
public class UserResponse {

    @QueryProjection
    public UserResponse(
            Long id,
            String nickname,
            Integer age
    ) {
    }
}
```

```java
List<UserResponse> result = queryFactory
        .select(
                new QUserResponse(
                        user.id,
                        user.nickname,
                        user.age
                )
        )
        .from(user)
        .fetch();
```

`@QueryProjection`은 타입 안전성이 높지만 DTO가 QueryDSL에 의존하게 된다.

---

## 14. 집계와 그룹화

```java
Tuple result = queryFactory
        .select(
                user.count(),
                user.age.avg()
        )
        .from(user)
        .fetchOne();
```

그룹화는 다음처럼 작성한다.

```java
List<Tuple> result = queryFactory
        .select(
                user.team.name,
                user.count()
        )
        .from(user)
        .groupBy(user.team.name)
        .having(user.count().gt(5))
        .fetch();
```

---

## 15. 수정과 삭제

### 벌크 수정

```java
long count = queryFactory
        .update(user)
        .set(user.nickname, "anonymous")
        .where(user.id.eq(userId))
        .execute();
```

### 벌크 삭제

```java
long count = queryFactory
        .delete(user)
        .where(user.id.eq(userId))
        .execute();
```

벌크 연산은 영속성 컨텍스트를 거치지 않고 DB에 직접 반영된다.

따라서 필요하면 실행 후 초기화한다.

```java
entityManager.flush();
entityManager.clear();
```

---

## 16. Spring Data JPA와 역할 분리

QueryDSL만으로 모든 Repository를 대체할 필요는 없다.

```text
Spring Data JPA
→ 단순 CRUD
→ 간단한 조회

QueryDSL
→ 복잡한 조회
→ 동적 조건
→ 조인
→ DTO 조회
```

구조는 다음처럼 나눌 수 있다.

```text
UserRepository
→ JpaRepository 상속

UserQueryRepository
→ QueryDSL 조회 전용
```

---

## 17. 장점

```text
1. 컴파일 시점에 필드 오류를 확인할 수 있다.
2. 문자열 JPQL보다 리팩터링에 안전하다.
3. 동적 쿼리를 작성하기 쉽다.
4. 조건을 메서드로 분리해 재사용할 수 있다.
5. 조인과 DTO 조회를 명확하게 표현할 수 있다.
6. IDE 자동완성을 활용할 수 있다.
```

---

## 18. 단점

```text
1. Q타입 생성 설정이 필요하다.
2. 빌드 설정이 다소 복잡하다.
3. 별도의 문법을 익혀야 한다.
4. 복잡한 쿼리는 코드가 길어질 수 있다.
5. 모든 SQL 기능을 JPA QueryDSL만으로 표현하기 어렵다.
6. @QueryProjection은 DTO를 QueryDSL에 의존시킨다.
```

---

## 19. 사용하기 좋은 경우

```text
검색 조건이 선택적으로 들어오는 경우
여러 엔티티를 조인하는 경우
DTO로 필요한 필드만 조회하는 경우
정렬과 페이징 조건이 복잡한 경우
문자열 JPQL이 길어지는 경우
```

단순 CRUD라면 Spring Data JPA만으로 충분할 수 있다.

---

## 20. 주의할 점

```text
fetchOne()
→ 결과가 여러 개면 예외가 발생할 수 있다.

컬렉션 fetch join + 페이징
→ 메모리 페이징이나 중복 문제가 생길 수 있다.

벌크 수정·삭제
→ 영속성 컨텍스트와 DB 값이 달라질 수 있다.

엔티티 직접 반환
→ 지연 로딩과 순환 참조 문제가 생길 수 있다.
```

---

## 21. 핵심 정리

```text
QueryDSL
→ 자바 코드로 타입 안전한 쿼리를 작성하는 도구

Q타입
→ 엔티티 필드를 쿼리에서 사용하기 위한 메타 모델

JPAQueryFactory
→ QueryDSL 쿼리를 만드는 핵심 객체

BooleanExpression
→ 동적 조건을 분리하고 조합하는 방식

fetch join
→ 연관 엔티티를 함께 조회하는 방식

DTO Projection
→ 필요한 필드만 DTO로 조회하는 방식
```

전체 흐름은 다음과 같다.

```text
엔티티 작성
→ Q타입 생성
→ QueryDSL 코드 작성
→ JPQL 생성
→ Hibernate가 SQL 생성
→ DB 실행
```

QueryDSL의 핵심 가치는 문자열 쿼리 대신 자바 코드로 쿼리를 작성해 타입 안전성과 동적 쿼리 가독성을 높이는 데 있다.
